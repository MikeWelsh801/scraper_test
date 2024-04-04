import axios, { AxiosError } from "axios";
import * as cheerio from "cheerio"

checkUACObservations("today")

/**
 * Loops through UAC regions and checks the forecast to see if their is any update.
 */
export async function checkUACObservations(currentDate: string) {
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
    let obs_list = await requestUACJson(region, "observations");

    for (let j = 0; j < 1; j++) {
      let observation = obs_list.observations[j].observation;

      // date, id, and type uniquely identify an observation in firebase
      let date = formatDate(observation.occurence_date);
      let url = observation.details;
      let urlParts: string[] = url.split("/");
      let id = urlParts[urlParts.length - 1]
      let type = observation.type.split(":")[0];

      if (await checkIfObservationIsNew("UAC", id, type, date)) {
        // scrape web and add to firebase
        let scraped_obs = await scrape_observation(url);
        scraped_obs["Coordinates"] = observation.coordinates;
        let string_obs = JSON.stringify(scraped_obs);
        console.log(string_obs);
      } else {
        // don't keep looking once we find one since the most recent are first
        // all others should be in firebase
        break;
      }
    }
  }
}

async function scrape_observation(url: string) {
  let test = "https://utahavalanchecenter.org/observation/84000"
  let data = await axios
    .get(test)
    .then(res => res.data)
    .catch((error: AxiosError) => {
      console.error(`Error requesting observation: ${error.config?.url}`);
      console.error(error.toJSON());
    });

  const parser = cheerio.load(data);

  // matches user input fields and field headers
  const block = parser('fieldset.group-red-flags.field-group-fieldset.form-wrapper').text().trim()
  const block_two = parser('fieldset.group-snow-characteristics.field-group-fieldset.form-wrapper').text().trim()
  const inputs = parser('div.text_02.mb2');
  const filtered_inputs = inputs.filter((input) => !block.includes(parser(inputs[input]).text().trim()) &&
                                       !block_two.includes(parser(inputs[input]).text().trim()))
  const headers = parser('div.field-label.text_02.bold.mb0');
  const filtered_headers = headers.filter((header) => !block.includes(parser(headers[header]).text().trim()) &&
                                         !block_two.includes(parser(headers[header]).text().trim()))

  const aveObservation: { [key: string]: string } = {};

  filtered_headers.each((index, element) => {
    const header = parser(element).text().trim();
    const input = parser(filtered_inputs[index]).text().trim();
    aveObservation[header] = input;
  });

  handleLists(aveObservation, block);
  handleLists(aveObservation, block_two);
  return aveObservation;

}

/**
 * This handles edge cases where user submits a list of text under a single header
 * @param aveObservation - the observation json
 * @param block - the list blocked out of regular parsing
 */
function handleLists(aveObservation: {[key: string]: string}, block: string) {
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

async function checkIfObservationIsNew(avalancheCenter: string, id: string, type: string, date: string): Promise<boolean> {
  return true;
}

/**
 * Requests the forecast from UAC and returns the JSON object.
 * @param region UAC region as a string
 * @returns JSON object of the forecast for that region. It by default returns the newest forecast from UAC.
 */
async function requestUACJson(region: string, type: string) {
  let res = await axios.get(
    `https://utahavalanchecenter.org/${type}/${region}/json`,
    {
      headers: { setUserAgent: "teamavyviz@gmail.com, AvyViz" },
    }
  );
  return res.data;
}

/**
 * Takes in a date string and converts it to a string in the format of MM-DD-YYYY.
 * @param date date in any Javascript Date format either a unix number or date string
 * @returns date in MM-DD-YYYY format
 */
function formatDate(date: string) {
  let slashRegex = new RegExp("/", "g");
  return date.replace(slashRegex, "-");
}
