/** BLS uses British "potato chips" for Pommes frites in some English names.
 * Our lookup vocabulary must distinguish fries from packaged crisps. Preserve
 * the source row/code/values, but disambiguate the translated display/index.
 */
export function blsEnglishName(row) {
  return /\bpommes frites\b/i.test(row[1])
    ? row[2].replace(/potato chips\/french fries/gi, 'French fries').replace(/potato chips/gi, 'French fries')
    : row[2];
}
