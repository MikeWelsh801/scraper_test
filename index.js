"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkUACObservations = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
checkUACObservations("today");
/**
 * Loops through UAC regions and checks the forecast to see if their is any update.
 */
function checkUACObservations(currentDate) {
    return __awaiter(this, void 0, void 0, function* () {
        let regions = [
            "logan",
            "ogden",
            "uintas",
            "salt-lake",
            "provo",
            "skyline",
            "moab",
            "abajos",
            "southwest",
        ];
        for (let i = 0; i < 1; i++) {
            let region = regions[i];
            let obs_list = yield requestUACJson(region, "observations");
            for (let j = 0; j < 1; j++) {
                let observation = obs_list.observations[j].observation;
                // date, id, and type uniquely identify an observation in firebase
                let date = formatDate(observation.occurence_date);
                let url = observation.details;
                let urlParts = url.split("/");
                let id = urlParts[urlParts.length - 1];
                let type = observation.type.split(":")[0];
                if (yield checkIfObservationIsNew("UAC", id, type, date)) {
                    // scrape web and add to firebase
                    let scraped_obs = yield scrape_observation(url);
                    scraped_obs["Coordinates"] = observation.coordinates;
                    let string_obs = JSON.stringify(scraped_obs);
                    console.log(string_obs);
                }
                else {
                    // don't keep looking once we find one since the most recent are first
                    // all others should be in firebase
                    break;
                }
            }
        }
    });
}
exports.checkUACObservations = checkUACObservations;
function scrape_observation(url) {
    return __awaiter(this, void 0, void 0, function* () {
        let test = "https://utahavalanchecenter.org/observation/84000";
        let data = yield axios_1.default
            .get(test)
            .then(res => res.data)
            .catch((error) => {
            var _a;
            console.error(`Error requesting observation: ${(_a = error.config) === null || _a === void 0 ? void 0 : _a.url}`);
            console.error(error.toJSON());
        });
        const parser = cheerio.load(data);
        // matches user input fields and field headers
        const block = parser('fieldset.group-red-flags.field-group-fieldset.form-wrapper').text().trim();
        const block_two = parser('fieldset.group-snow-characteristics.field-group-fieldset.form-wrapper').text().trim();
        const inputs = parser('div.text_02.mb2');
        const filtered_inputs = inputs.filter((input) => !block.includes(parser(inputs[input]).text().trim()) &&
            !block_two.includes(parser(inputs[input]).text().trim()));
        const headers = parser('div.field-label.text_02.bold.mb0');
        const filtered_headers = headers.filter((header) => !block.includes(parser(headers[header]).text().trim()) &&
            !block_two.includes(parser(headers[header]).text().trim()));
        const aveObservation = {};
        filtered_headers.each((index, element) => {
            const header = parser(element).text().trim();
            const input = parser(filtered_inputs[index]).text().trim();
            aveObservation[header] = input;
        });
        handleLists(aveObservation, block);
        handleLists(aveObservation, block_two);
        return aveObservation;
    });
}
/**
 * This handles edge cases where user submits a list of text under a single header
 * @param aveObservation - the observation json
 * @param block - the list blocked out of regular parsing
 */
function handleLists(aveObservation, block) {
    const block_list = block.split('\n');
    // this takes care of an edge case where a user can submit a list of 
    // flags under one header
    let red_flags = "";
    for (let i = 2; i < block_list.length; i++) {
        if (!block_list[i].trim()) {
            continue;
        }
        red_flags += block_list[i].trim();
        if (i != block_list.length - 1) {
            red_flags += ", ";
        }
    }
    if (red_flags != "")
        aveObservation[block_list[0].trim()] = red_flags;
}
function checkIfObservationIsNew(avalancheCenter, id, type, date) {
    return __awaiter(this, void 0, void 0, function* () {
        return true;
    });
}
/**
 * Requests the forecast from UAC and returns the JSON object.
 * @param region UAC region as a string
 * @returns JSON object of the forecast for that region. It by default returns the newest forecast from UAC.
 */
function requestUACJson(region, type) {
    return __awaiter(this, void 0, void 0, function* () {
        let res = yield axios_1.default.get(`https://utahavalanchecenter.org/${type}/${region}/json`, {
            headers: { setUserAgent: "teamavyviz@gmail.com, AvyViz" },
        });
        return res.data;
    });
}
/**
 * Takes in a date string and converts it to a string in the format of MM-DD-YYYY.
 * @param date date in any Javascript Date format either a unix number or date string
 * @returns date in MM-DD-YYYY format
 */
function formatDate(date) {
    let slashRegex = new RegExp("/", "g");
    return date.replace(slashRegex, "-");
}
