const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const PLATFORMS = {
	all: 'all',
	win32: 'windows',
	darwin: 'macos',
	linux: 'linux',
};

async function isValid() {

	const settingsFiles = Object.values(PLATFORMS).map(os => getSettingFilePath(os));
  
	const results = await Promise.all(settingsFiles.map(fileExists));
  
	// all: true, mac: false, windows: true, linux: true
	return !!results[0] || !!results[1] || !!results[2] || !!results[3];
}

function getSettingFilePath(os) {
	
	const fileName = os ? `settings.${os}.json` : 'settings.json';

	return path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.vscode', fileName);
}

async function getSettingsFileContent(os) {
	const filePath = getSettingFilePath(os);
	return getFileContent(filePath)
}

function getOsName() {
	const os = process.platform;
	if (PLATFORMS.hasOwnProperty(os)) {
		return PLATFORMS[os];
	} else {
		vscode.window.showErrorMessage(`Unsupported operating system: ${os}`);
		return false;
	}
}

async function fileExists(filePath) {
	try {
	  await fs.promises.access(filePath, fs.constants.F_OK);
	  return true;
	} catch (error) {
	  return false;
	}
  }
  
async function getFileContent(filePath) {
	if (await fileExists(filePath)) {
		try {
		const osSettings = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
		return osSettings;
		} catch (error) {
		vscode.window.showErrorMessage(`Error reading settings file: ${error.message}`);
		return {};
		}
	} else {
		vscode.window.showErrorMessage(`Settings file not found: ${filePath}`);
		return {};
	}
}

async function getDefaultSettingsFileContent() {

	const all = await getSettingsFileContent(PLATFORMS.all);

	if (all) {
		return all;
	}

	const settings = await getSettingsFileContent();

	if(settings) {
		return settings;
	}

	return {}
}

async function updateSettingsFile(newSettings) {

	const filePath = getSettingFilePath();

	if (!await fileExists(filePath)) {
		await createFileIfNotExists(filePath, '{}');
	}

	const defaultSettings = await getDefaultSettingsFileContent();
	const settings = deepMerge(defaultSettings, newSettings);

	return new Promise((resolve, reject) => {
		fs.writeFile(filePath, JSON.stringify(settings, null, 4), 'utf8', (error) => {
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}

function deepMerge(target, source) {
	const output = Object.assign({}, target);

	if (isObject(target) && isObject(source)) {
		Object.keys(source).forEach(key => {
			if (isObject(source[key])) {
				if (!(key in target)) {
					Object.assign(output, { [key]: source[key] });
				} else {
					output[key] = deepMerge(target[key], source[key]);
				}
			} else {
				Object.assign(output, { [key]: source[key] });
			}
		});
	}

	return output;
}

function isObject(item) {
	return (item && typeof item === 'object' && !Array.isArray(item));
}

async function createFileIfNotExists(filePath, content = '') {
	try {
		// Ensure the directory exists
		const dirPath = path.dirname(filePath);
		await fs.mkdir(dirPath, { recursive: true });

		// Check if the file exists
		const fileExists = await fs.access(filePath)
			.then(() => true)
			.catch(() => false);

		// Create the file if it doesn't exist
		if (!fileExists) {
			await fs.writeFile(filePath, content);
			console.log(`File created: ${filePath}`);
		} else {
			console.log(`File already exists: ${filePath}`);
		}
	} catch (error) {
		console.error(`Error while creating file: ${error.message}`);
	}
}

async function vsCodeUpdateSettingsFile() {

	if (!await isValid()) {
		vscode.window.showErrorMessage('No workspace folder opened.');
		return;
	}

	const workspaceFolders = vscode.workspace.workspaceFolders;

	if (!workspaceFolders) {
		vscode.window.showErrorMessage('No workspace folder opened.');
		return;
	}

	const os = getOsName();
	const osSettings = await getSettingsFileContent(os);

	try {
		await updateSettingsFile(osSettings);
		vscode.window.showInformationMessage(`Updated settings.json for ${os} operating system.`);
	} catch (error) {
		vscode.window.showErrorMessage(`Error updating settings.json: ${error.message}`);
	}
}

module.exports = {
	vsCodeUpdateSettingsFile
}