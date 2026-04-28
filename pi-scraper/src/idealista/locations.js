// Maps casahunt neighborhood slugs → Idealista URL path segments.
// Idealista URLs look like:
//   https://www.idealista.com/alquiler-viviendas/barcelona/<district>/<neighborhood>/
//   https://www.idealista.com/alquiler-viviendas/barcelona/<district>/            (whole district)
//   https://www.idealista.com/alquiler-viviendas/barcelona-barcelona/             (whole city)
//
// Our neighborhoods.js uses friendly slugs that mostly match Idealista's, but a
// handful differ (accents, word order). Overrides below; everything else uses
// the same slug on both sides.

export const IDEALISTA_BASE = "https://www.idealista.com";

// casahunt district name → Idealista district path segment
export const DISTRICT_PATHS = {
  "Ciutat Vella":       "ciutat-vella",
  "Eixample":           "eixample",
  "Sants-Montjuïc":     "sants-montjuic",
  "Les Corts":          "les-corts",
  "Sarrià-Sant Gervasi": "sarria-sant-gervasi",
  "Gràcia":             "gracia",
  "Horta-Guinardó":     "horta-guinardo",
  "Nou Barris":         "nou-barris",
  "Sant Andreu":        "sant-andreu",
  "Sant Martí":         "sant-marti",
};

// casahunt neighborhood slug → Idealista neighborhood path segment
// Override only where Idealista disagrees with our slug.
export const NEIGHBORHOOD_OVERRIDES = {
  "el-gotic":                         "barri-gotic",
  "sant-pere-santa-caterina-la-ribera": "sant-pere-santa-caterina-i-la-ribera",
  "antiga-esquerra-eixample":         "la-antigua-izquierda-del-ensanche",
  "nova-esquerra-eixample":           "la-nueva-izquierda-del-ensanche",
  "dreta-eixample":                   "la-derecha-del-ensanche",
  "sagrada-familia":                  "sagrada-familia",
  "fort-pienc":                       "el-fort-pienc",
  "poble-sec":                        "el-poble-sec-parc-de-montjuic",
  "marina-prat-vermell":              "la-marina-del-prat-vermell-zona-franca",
  "marina-de-port":                   "la-marina-de-port",
  "font-de-la-guatlla":               "la-font-de-la-guatlla",
  "maternitat-sant-ramon":            "la-maternitat-i-sant-ramon",
  "vallvidrera-tibidabo-planes":      "vallvidrera-el-tibidabo-i-les-planes",
  "tres-torres":                      "les-tres-torres",
  "sant-gervasi-bonanova":            "sant-gervasi-la-bonanova",
  "sant-gervasi-galvany":             "sant-gervasi-galvany",
  "putxet-farro":                     "el-putxet-i-el-farro",
  "vallcarca-penitents":              "vallcarca-i-els-penitents",
  "vila-de-gracia":                   "la-vila-de-gracia",
  "camp-den-grassot-gracia-nova":     "el-camp-d-en-grassot-i-gracia-nova",
  "baix-guinardo":                    "el-baix-guinardo",
  "can-baro":                         "can-baro",
  "font-den-fargues":                 "la-font-d-en-fargues",
  "sant-genis-agudells":              "sant-genis-dels-agudells",
  "vall-hebron":                      "la-vall-d-hebron",
  "la-clota":                         "la-clota",
  "vilapicina-torre-llobeta":         "vilapicina-i-la-torre-llobeta",
  "turo-de-la-peira":                 "el-turo-de-la-peira",
  "can-peguera":                      "can-peguera",
  "guineueta":                        "la-guineueta",
  "roquetes":                         "les-roquetes",
  "prosperitat":                      "la-prosperitat",
  "trinitat-nova":                    "la-trinitat-nova",
  "ciutat-meridiana":                 "ciutat-meridiana",
  "trinitat-vella":                   "la-trinitat-vella",
  "baro-de-viver":                    "baro-de-viver",
  "bon-pastor":                       "el-bon-pastor",
  "la-sagrera":                       "la-sagrera",
  "congres-indians":                  "el-congres-i-els-indians",
  "camp-de-larpa-del-clot":           "el-camp-de-l-arpa-del-clot",
  "parc-llacuna-poblenou":            "el-parc-i-la-llacuna-del-poblenou",
  "vila-olimpica-poblenou":           "la-vila-olimpica-del-poblenou",
  "poblenou":                         "el-poblenou",
  "diagonal-mar-front-maritim":       "diagonal-mar-i-el-front-maritim",
  "besos-maresme":                    "el-besos-i-el-maresme",
  "provencals-poblenou":              "provencals-del-poblenou",
  "sant-marti-provencals":            "sant-marti-de-provencals",
  "verneda-pau":                      "la-verneda-i-la-pau",
};

// Single source of truth: neighborhood slug → { district, neighborhood } paths
// Caller passes the casahunt neighborhood record (has .district and .slug).
export function paths(casahuntSlug, districtName) {
  const district = DISTRICT_PATHS[districtName];
  if (!district) return null;
  const neighborhood = NEIGHBORHOOD_OVERRIDES[casahuntSlug] || casahuntSlug;
  return { district, neighborhood };
}
