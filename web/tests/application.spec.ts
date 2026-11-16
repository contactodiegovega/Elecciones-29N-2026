import { test, expect, type Page } from "@playwright/test";
// Kept as a regular file so Playwright can discover it on Windows/OneDrive.
import path from "node:path";

const capture = async (page: Page, name: string) => {
  if (process.env.CAPTURE_DOCS === "1") await page.screenshot({ path: path.resolve(__dirname, "../../docs/screenshots", name + ".png"), fullPage: true });
};

test.afterEach(async ({ page }) => {
  expect(await page.pageErrors()).toEqual([]);
});

test("León inicial: reparto, calculadora visible y carga ligera", async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", r => requests.push(r.url()));
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "El Último Escaño", exact: true })).toBeVisible();
  await expect(page.getByTestId("province-analysis")).toHaveAttribute("data-province", "24");
  await expect(page.getByRole("combobox", { name: "Tu provincia, tu último escaño" })).toHaveValue("León");
  await expect(page.locator("#nav-principal a")).toHaveCount(4);
  const history = page.getByRole("region", { name: "Resultados oficiales de León en 2023" });
  await expect(history).toContainText("46.289,00");
  await expect(history).toContainText("35.451,00");
  await expect(history).toContainText("422.917");
  await expect(page.getByRole("row").filter({ hasText: "PP" })).toContainText("101.605");
  const box = await page.getByRole("region", { name: "Calculadora de cambios hipotéticos" }).boundingBox();
  expect(box!.y).toBeLessThan(900);
  expect(requests.some(r => r.includes(".geojson"))).toBe(false);
  expect(requests.some(r => r.includes("labels_by_election") || r.includes("turnout.json"))).toBe(false);
  await capture(page, "inicio-leon-desktop");
  expect(errors).toEqual([]);
});

test("León: mínimo entero, adición y transferencia conservando el total", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("province-analysis")).toHaveAttribute("data-province", "24");
  await expect(page.getByRole("combobox", { name: "Candidatura de destino" }).locator("option")).toHaveCount(12);
  await page.getByRole("combobox", { name: "Candidatura para votos mínimos" }).selectOption("VOX - VOX");
  await expect(page.getByTestId("minimum-votes")).toContainText("10.839");
  await page.getByRole("combobox", { name: "Candidatura de destino" }).selectOption("VOX - VOX");
  const votes = page.getByRole("spinbutton", { name: "Cantidad de votos hipotéticos" });
  const scenario = page.getByRole("region", { name: "Resultado del escenario" });
  await votes.fill("10838");
  await expect(scenario.getByRole("img")).toHaveAttribute("aria-label", /PSOE 2/);
  await votes.fill("10839");
  await expect(scenario.getByRole("img")).toHaveAttribute("aria-label", /VOX 1/);
  await expect(scenario).toContainText("Escenario hipotético");
  await capture(page, "leon-escenario");
  await page.getByRole("button", { name: "Transferir votos", exact: true }).click();
  await page.getByRole("combobox", { name: "Candidatura de origen" }).selectOption("PARTIDO POPULAR - PP");
  await page.getByRole("combobox", { name: "Candidatura de destino" }).selectOption("VOX - VOX");
  await votes.fill("20000");
  await expect(scenario).toContainText("275.240");
  await expect(page.getByRole("row").filter({ hasText: "PP" })).toContainText("81.605");
  await votes.fill("1000000000");
  await expect(page.getByRole("region", { name: "Calculadora de cambios hipotéticos" }).getByRole("alert")).toContainText("no supere los votos");
  await page.getByRole("button", { name: "Restablecer 2023" }).click();
  await expect(votes).toHaveValue("0");
  await expect(scenario.getByRole("img")).toHaveAttribute("aria-label", /PP 2/);
});

test("buscador, URLs explícitas, 52 JSON y compatibilidad de rutas", async ({ page, request }) => {
  await page.goto("/?province=28");
  await expect(page.getByTestId("province-analysis")).toHaveAttribute("data-province", "28");
  const controls = page.getByRole("region", { name: "Calculadora de cambios hipotéticos" });
  await controls.getByText("Más controles:", { exact: false }).click();
  await page.getByRole("combobox", { name: "Asignación provincial del escenario" }).selectOption("2026");
  await expect(page.getByRole("region", { name: "Resultado del escenario" }).locator(".seat-symbol")).toHaveCount(38);
  const picker = page.getByRole("combobox", { name: "Tu provincia, tu último escaño" });
  await picker.fill("leon");
  await picker.press("Enter");
  await expect(page.getByTestId("province-analysis")).toHaveAttribute("data-province", "24");
  await expect(page).toHaveURL(/province=24/);
  await expect(page.getByRole("spinbutton", { name: "Cantidad de votos hipotéticos" })).toHaveValue("0");
  const index = await (await request.get("/data/provinces/index.json")).json();
  expect(index).toHaveLength(52);
  let seats2023 = 0, seats2026 = 0;
  for (const province of index) {
    const response = await request.get(`/data/provinces/${province.code}.json`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.code).toBe(province.code);
    seats2023 += data.seats2023; seats2026 += data.seats2026;
  }
  expect([seats2023, seats2026]).toEqual([350, 350]);
  await page.goto("/ultimo-escano?province=11");
  await expect(page.getByTestId("province-analysis")).toHaveAttribute("data-province", "11");
  await expect(page).toHaveURL(/\/?\?province=11/);
  await page.goto("/?province=99");
  await expect(page.getByTestId("province-analysis")).toHaveAttribute("data-province", "24");
  await expect(page.getByText("No reconocemos esa circunscripción.", { exact: false })).toBeVisible();
});

test("mapa real y selección de circunscripciones pequeñas", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(`${page.url()}: ${e.stack ?? e.message}`));
  await page.goto("/provincias");
  await expect(page.getByTestId("mapa-provincias").locator("canvas")).toBeVisible();
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Seleccionar Ceuta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ceuta", exact: true })).toBeVisible();
  await capture(page, "provincias-desktop");
  await page.getByRole("link", { name: "Ver su último escaño y cambiar votos", exact: false }).click();
  await expect(page.getByTestId("province-analysis")).toHaveAttribute("data-province", "51");
  await page.getByRole("button", { name: "Elegir en el mapa", exact: false }).click();
  await expect(page.getByTestId("mapa-provincias").locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Seleccionar Melilla", exact: true }).click();
  await expect(page.getByTestId("province-analysis")).toHaveAttribute("data-province", "52");
  expect(errors).toEqual([]);
});

test("encuestas sencillas y exploración avanzada diferida", async ({ page }) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", r => requests.push(r.url()));
  await page.goto("/encuestas");
  await expect(page.getByRole("heading", { name: "Últimas encuestas", exact: true })).toBeVisible();
  await expect(page.getByTestId("latest-poll")).toHaveCount(3);
  await expect(page.getByTestId("latest-poll").first()).toContainText("12 nov 2026");
  expect(requests.some(r => r.includes("polls_2026.json"))).toBe(false);
  await expect(page.getByTestId("encuestas-serie")).toHaveCount(0);
  await capture(page, "encuestas-desktop");
  await page.getByRole("button", { name: "Explorar todas las encuestas y su evolución", exact: false }).click();
  await expect(page.getByTestId("encuestas-serie").locator("canvas")).toBeVisible();
  await page.getByRole("combobox", { name: "Partido", exact: true }).selectOption("PSOE");
  await page.getByRole("combobox", { name: "Encuestadora", exact: true }).selectOption("CIS");
  await expect(page.getByRole("combobox", { name: "Medio o patrocinador" })).toBeVisible();
  await page.getByRole("combobox", { name: "Tipo de medición" }).selectOption("direct_intention");
  await expect(page.getByTestId("encuestas-serie").locator("canvas")).toBeVisible();
  expect(errors).toEqual([]);
});

test("móvil: buscador y calculadora accesibles, menú y sin desbordamientos", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByTestId("province-analysis")).toHaveAttribute("data-province", "24");
  await expect(page.getByTestId("mapa-provincias")).toHaveCount(0);
  const picker = page.getByRole("combobox", { name: "Tu provincia, tu último escaño" });
  await expect(picker).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, "inicio-leon-mobile");
  await page.getByRole("button", { name: "Menú", exact: true }).click();
  await expect(page.getByRole("link", { name: "Encuestas", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Encuestas", exact: true }).click();
  await expect(page.getByTestId("latest-poll")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, "encuestas-mobile");
  await page.goto("/aprende");
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(page.getByText("Diputado 2 de 4", { exact: true })).toBeVisible();
  await capture(page, "aprende-mobile");
});

test("un error de ficha permite reintentar sin cambiar de página", async ({ page }) => {
  let first = true;
  await page.route("**/data/provinces/28.json", async route => {
    if (first) { first = false; await route.fulfill({ status: 503, body: "temporalmente no disponible" }); }
    else await route.continue();
  });
  await page.goto("/?province=28");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("No se pudieron cargar");
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(page.getByTestId("province-analysis")).toHaveAttribute("data-province", "28");
});

test("sin sondeos verificados se explica el vacío y se conserva acceso al archivo", async ({ page }) => {
  await page.route("**/data/latest_polls.json", route => route.fulfill({ json: {
    generated_at: "2026-11-14T12:00:00Z", restricted: false, polls: [], total_verified: 0,
    last_update: null, sources: [], note: "Sin publicaciones verificadas en esta revisión de prueba.",
  } }));
  await page.goto("/encuestas");
  await expect(page.getByRole("heading", { name: "Aún no hay publicaciones verificadas para esta vista" })).toBeVisible();
  await expect(page.getByTestId("latest-poll")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Explorar todas las encuestas y su evolución", exact: false })).toBeVisible();
});
