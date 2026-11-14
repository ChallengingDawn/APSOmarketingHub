import { downloadXlsx, type Cell, type Sheet } from "./xlsx";

// ─────────────────────────────────────────────────────────────────────────────
// Excel export of the APSOparts scraper's products and dimensions. It was built with SheetJS on the PricingHub
// dashboard; in the hub it is the hub's own writer (./xlsx.ts) - a light cell per value, no styled cell model, so a
// large catalogue still exports - with widths, number formats, the header frozen and filtered, several sheets.
// ─────────────────────────────────────────────────────────────────────────────

function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = typeof v === "string" ? parseFloat(v) : Number(v);
  return isNaN(x) ? null : x;
}

type ColDef = { header: string; key: string; w: number; price?: boolean; num?: boolean };

// A sheet from column defs + rows: widths, number formats (prices 0.00, counts 0), the header frozen and filtered.
function buildSheet(
  name: string,
  cols: ColDef[],
  data: Record<string, unknown>[],
  getValue: (row: Record<string, unknown>, col: ColDef) => string | number | null
): Sheet {
  return {
    name,
    columns: cols.map((c) => ({ header: c.header, width: c.w, format: c.price ? "money" : c.num ? "int" : undefined })),
    rows: data.map((item) => cols.map((c): Cell => getValue(item, c) ?? "")),
  };
}

// ─── PRODUCTS SHEET (HubSpot pricing data) ──────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function productsSheet(products: any[]): Sheet {
  const cols: ColDef[] = [
    { header: "Profit Center", key: "profit_center", w: 14 },
    { header: "Assortment", key: "assort", w: 26 },
    { header: "Main Group", key: "mg", w: 30 },
    { header: "Sub Group", key: "sg", w: 30 },
    { header: "Product Number", key: "product_number", w: 16 },
    { header: "Product Description", key: "product_description", w: 34 },
    { header: "Article Number", key: "article_number", w: 16 },
    { header: "Description", key: "description", w: 42 },
    { header: "Material", key: "mat", w: 18 },
    { header: "Type", key: "product_type_normalized", w: 14 },
    { header: "Color", key: "col", w: 12 },
    { header: "Diameter", key: "diameter", w: 12, num: true },
    { header: "Mandant", key: "mandant", w: 10 },
    { header: "Currency", key: "currency", w: 9 },
    { header: "Status", key: "article_status", w: 12 },
    { header: "Stock", key: "stock", w: 10, num: true },
    { header: "Sales Unit", key: "sales_unit", w: 11 },
    { header: "MOQ", key: "moq", w: 8 },
    { header: "GWstDP", key: "gdwst_price", w: 12, price: true },
    { header: "List Price", key: "listprice", w: 12, price: true },
    { header: "Bronze", key: "bronze_price", w: 12, price: true },
    { header: "Silver", key: "silver_price", w: 12, price: true },
    { header: "Gold", key: "gold_price", w: 12, price: true },
    { header: "Platinum", key: "platinum_price", w: 12, price: true },
    { header: "Hardness", key: "hardness", w: 12 },
    { header: "AP Compound", key: "ap_compound", w: 22 },
    { header: "Conformities", key: "conformities", w: 22 },
    { header: "Budget Class", key: "budget_class", w: 12 },
  ];
  return buildSheet("Products", cols, products, (p, col) => {
    switch (col.key) {
      case "assort": return p.assortment_number ? `${p.assortment_number} — ${p.assortment_description || ""}` : "";
      case "mg": return p.main_group_number ? `${p.main_group_number} — ${p.main_group_description || ""}` : "";
      case "sg": return p.sub_group_number ? `${p.sub_group_number} — ${p.sub_group_description || ""}` : "";
      case "mat": return ((p.material_normalized || p.material || "") as string).toUpperCase();
      case "col": return (p.color_normalized || p.color || "") as string;
      case "diameter": case "stock": return n(p[col.key]);
      default: return col.price ? n(p[col.key]) : ((p[col.key] as string) || "");
    }
  });
}

// ─── SCRAPED PRODUCTS SHEET ─────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scrapedProductsSheet(products: any[]): Sheet {
  const cols: ColDef[] = [
    { header: "SKU", key: "parent_sku", w: 36 },
    { header: "Product Name", key: "product_name", w: 44 },
    { header: "Material", key: "material", w: 22 },
    { header: "Compound", key: "compound_ref", w: 22 },
    { header: "Hardness", key: "hardness", w: 14 },
    { header: "Temp Range", key: "temp_range", w: 18 },
    { header: "Color", key: "color", w: 14 },
    { header: "Conformity", key: "conformity", w: 30 },
    { header: "Standard", key: "standard", w: 22 },
    { header: "Category", key: "category_path", w: 36 },
    { header: "Description", key: "description", w: 50 },
  ];
  return buildSheet("Product Library", cols, products, (p, col) => {
    const v = p[col.key];
    if (col.key === "description" && typeof v === "string") return v.substring(0, 500);
    return (v as string) || "";
  });
}

// ─── DIMENSIONS SHEET (with dynamic dimension columns) ──────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dimensionsSheet(dims: any[]): Sheet {
  const allDimKeys = new Set<string>();
  for (const d of dims) {
    if (d.dimensions_json && typeof d.dimensions_json === "object") {
      for (const key of Object.keys(d.dimensions_json)) allDimKeys.add(key);
    }
  }
  const dimKeys = Array.from(allDimKeys).sort();

  const cols: ColDef[] = [
    { header: "SKU (Article)", key: "sku", w: 22 },
    { header: "Parent SKU", key: "parent_sku", w: 36 },
    { header: "Product Name", key: "product_name", w: 36 },
    { header: "Material", key: "material", w: 20 },
    ...dimKeys.map((k) => ({ header: k, key: `dim__${k}`, w: 16 })),
    { header: "AS/BS Number", key: "as_bs_number", w: 16 },
  ];
  return buildSheet("Article Dimensions", cols, dims, (d, col) => {
    if (col.key.startsWith("dim__")) {
      const dimKey = col.key.replace("dim__", "");
      const json = d.dimensions_json as Record<string, string> | null;
      return json?.[dimKey] || "";
    }
    return (d[col.key] as string) || "";
  });
}

// ─── SUMMARY SHEET ──────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summarySheet(data: { products?: any[]; scrapedProducts?: any[]; dims?: any[] }, label: string): Sheet {
  const now = new Date();
  const rows: (string | number)[][] = [
    ["APSO Pricing Hub — Export Summary", ""],
    ["Export Date", `${now.toLocaleDateString("en-GB")} ${now.toLocaleTimeString("en-GB")}`],
    ["Filter", label],
    ["", ""],
  ];

  if (data.products) {
    rows.push(["HUBSPOT PRODUCTS", ""]);
    rows.push(["Total", data.products.length]);
    rows.push(["M100 (CHF)", data.products.filter((p) => p.mandant === "M100").length]);
    rows.push(["M110 (EUR)", data.products.filter((p) => p.mandant === "M110").length]);
    rows.push(["With List Price", data.products.filter((p) => n(p.listprice) != null).length]);
    rows.push(["With Gold Price", data.products.filter((p) => n(p.gold_price) != null).length]);
    rows.push(["", ""]);
  }
  if (data.scrapedProducts) {
    rows.push(["SCRAPED PRODUCT LIBRARY", ""]);
    rows.push(["Total Products", data.scrapedProducts.length]);
    rows.push(["With Material", data.scrapedProducts.filter((p) => p.material).length]);
    rows.push(["With Conformity", data.scrapedProducts.filter((p) => p.conformity).length]);
    rows.push(["", ""]);
  }
  if (data.dims) {
    rows.push(["ARTICLE DIMENSIONS", ""]);
    rows.push(["Total Articles", data.dims.length]);
    rows.push(["Unique Parents", new Set(data.dims.map((d) => d.parent_sku)).size]);
    rows.push(["With Dimensions", data.dims.filter((d) => d.dimensions_json && Object.keys(d.dimensions_json).length > 0).length]);
  }

  // a plain sheet: no header row, no filter
  return { name: "Summary", columns: [{ header: "", width: 28 }, { header: "", width: 18 }], rows, table: false };
}

// ─── PUBLIC EXPORTS ─────────────────────────────────────────────
export type ExportMode = "products" | "dimensions" | "both";
export type ExportSource = "hubspot" | "scraper";

export async function exportProductsExcel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products: any[] | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dimensions: any[] | null,
  filterLabel: string,
  mode: ExportMode,
  source: ExportSource = "hubspot"
) {
  const sheets: Sheet[] = [];

  if (products && (mode === "products" || mode === "both")) {
    sheets.push(source === "scraper" ? scrapedProductsSheet(products) : productsSheet(products));
  }
  if (dimensions && (mode === "dimensions" || mode === "both")) {
    sheets.push(dimensionsSheet(dimensions));
  }

  const summaryData: { products?: unknown[]; scrapedProducts?: unknown[]; dims?: unknown[] } = {};
  if (products && source === "hubspot") summaryData.products = products;
  if (products && source === "scraper") summaryData.scrapedProducts = products;
  if (dimensions) summaryData.dims = dimensions;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheets.push(summarySheet(summaryData as any, filterLabel));

  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const slug = filterLabel.replace(/[^a-zA-Z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").substring(0, 30);
  const src = source === "scraper" ? "Scraped" : "";
  const what = mode === "both" ? "Full" : mode === "products" ? "Products" : "Dimensions";
  const filename = `APSOPricingHub_${src}${what}_${slug}_${ts}.xlsx`;

  await downloadXlsx(filename, sheets);

  return { filename, productCount: products?.length ?? 0, dimensionCount: dimensions?.length ?? 0 };
}
