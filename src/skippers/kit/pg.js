// `Workbook p.NN` receipt text for a page number or a list of pages
export const pg = (p) => (Array.isArray(p) ? `Workbook p.${p.join(', ')}` : `Workbook p.${p}`);
