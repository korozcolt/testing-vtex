const XLSX = require('xlsx');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
dotenv = require('dotenv').config();

const SHEET_NAME = 'BBDD';
const VTEX_API_URL = process.env.VTEX_API_URL;
const VTEX_API_KEY = process.env.VTEX_API_KEY;
const VTEX_API_TOKEN = process.env.VTEX_API_TOKEN;
const VTEX_ENTITY = process.env.VTEX_ENTITY;

const REGEX = /[^\w ;ñáéíóú\(\)"]/g; // Regex for removing accents and special characters
const homePhoneDuplicates = [];

const checkHomePhoneExists = async (homePhone) => {
    try {
        const response = await axios.get(
            `${VTEX_API_URL}/api/dataentities/${VTEX_ENTITY}/search`,
            {
                params: {
                    _fields: '_all',
                    homePhone: homePhone,
                },
                headers: {
                    'X-VTEX-API-AppKey': VTEX_API_KEY,
                    'X-VTEX-API-AppToken': VTEX_API_TOKEN,
                    'cache-control': 'no-cache',
                    'pragma': 'no-cache',
                },
            }
        );
        console.log('Response:', response.data[0].homePhone);
        console.log('Request:', homePhone.toString());
        console.log('Check:', response.data[0].homePhone === homePhone.toString());
        return response.data.length > 0 && response.data[0].homePhone === homePhone.toString();
    } catch (error) {
        console.error('Error checking home phone:', error);
        return false;
    }
};

const validateData = async (jsonData) => {
    const data = JSON.parse(jsonData);
    const errors = [];

    for (const [index, row] of data.entries()) {
        for (const value of Object.values(row)) {
            if (REGEX.test(value)) {
                errors.push({
                    row: index + 1,
                    column: 'Caracteres no permitidos',
                    error: `El valor "${value}" contiene caracteres no permitidos. Solo se permiten letras, números, espacios, punto y coma, ñ, á, é, í, ó, ú, paréntesis.`,
                });
            }
        }

        if (row.homePhone) {
            if (homePhoneDuplicates.includes(row.homePhone)) {
                errors.push({
                    row: index + 1,
                    column: 'Teléfono residencial',
                    error: `El teléfono residencial "${row.homePhone}" se encuentra duplicado.`,
                });
            } else {
                homePhoneDuplicates.push(row.homePhone);
            }
        }

        // const exists = await checkHomePhoneExists(row.homePhone);
        // if (exists) {
        //     errors.push({
        //         row: index + 1,
        //         column: 'Teléfono residencial',
        //         error: `El teléfono residencial "${row.homePhone}" ya existe en la base de datos.`,
        //     });
        // }

        if (row.codigo && row.codigo.length !== 8) {
            errors.push({
                row: index + 1,
                column: 'Código',
                error: `El código debe tener exactamente 9 caracteres numéricos.`,
            });
        }

        if (row.id && row.id.length !== 17) {
            errors.push({
                row: index + 1,
                column: 'ID',
                error: `El ID debe tener exactamente 17 caracteres numéricos.`,
            });
        }

        if (row.codigo && !/^\d+$/.test(row.codigo)) {
            errors.push({
                row: index + 1,
                column: 'Código',
                error: `El código debe contener solo números.`,
            });
        }

        if (row.id && !/^\d+$/.test(row.id)) {
            errors.push({
                row: index + 1,
                column: 'ID',
                error: `El ID debe contener solo números.`,
            });
        }
    }

    return errors;
};

const readFile = (filePath, sheetName) => {
    const fullPath = path.resolve(__dirname, filePath);
    console.log(`Trying to read file from: ${fullPath}`);
    const workbook = XLSX.readFile(fullPath);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    return data;
};

const processExcel = async (filePath, sheetName) => {
    const data = await readFile(filePath, sheetName);
    const jsonData = JSON.stringify(data);

    const validationErrors = await validateData(jsonData);

    if (validationErrors.length > 0) {
        console.error('Errores de validación:');
        console.error(validationErrors);

        const errorFilePath = path.resolve(__dirname, 'data/errors', `${path.basename(filePath, '.xlsx')}.json`);
        fs.writeFileSync(errorFilePath, JSON.stringify(validationErrors, null, 2));

        const errorFilePathOriginal = path.resolve(__dirname, 'data/pending', path.basename(filePath));
        const errorFilePathNew = path.resolve(__dirname, 'data/errors', path.basename(filePath));
        fs.renameSync(errorFilePathOriginal, errorFilePathNew);
    } else {
        console.log('Validación completada sin errores.');
        console.log('Datos JSON:');
        console.log(jsonData);

        const processedFilePathOriginal = path.resolve(__dirname, 'data/pending', path.basename(filePath));
        const processedFilePathNew = path.resolve(__dirname, 'data/processed', path.basename(filePath));
        fs.renameSync(processedFilePathOriginal, processedFilePathNew);
    }
};

const processPendingFiles = async () => {
    const pendingDir = path.resolve(__dirname, 'data/pending');
    const files = fs.readdirSync(pendingDir);

    for (const file of files) {
        const filePath = path.join(pendingDir, file);
        await processExcel(filePath, SHEET_NAME);
    }
};

processPendingFiles();