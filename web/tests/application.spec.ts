import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const capture = async (page: Page, name: string) => {
  if (process.env.CAPTURE_DOCS === "1") await page.screenshot({ path: path.resolve(__dirname, "../../docs/screenshots", name + ".png"), fullPage: true });
};
test.afterEach(async ({ page }) => { expect(await page.pageErrors()).toEqual([]); });

test("León inicial: reparto oficial, calculadora inmediata y navegación", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", r => requests.push(r.url()));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "El Último Escaño", exact: true })).toBeVisible();
  await expect(page.getByTestId("province-analysis")).toHaveAttribute("data-province", "24");
  await expect(page.getByRole("main")).not.toContainText("Revisión limitada");
  await expect(page.getByRole("region", { name: "Resultado del escenario" })).toContainText("Antes · oficial 2023");
  await expect(page.locator("#nav-principal a")).toHaveText(["Inicio", "Provincias", "¿Qué pasaría si…?", "Aprende más"]);
  const history = page.getByRole("region", { name: "Resultados oficiales de León en 2023" });
  await expect(history).toContainText("46.289,00");
  await expect(history).toContainText("35.451,00");
  const box = await page.getByRole("region", { name: "Calculadora de cambios hipotéticos" }).boundingBox();
  expect(box!.y).toBeLessThan(900);
  expect(requests.some(r => /poll|geojson|labels_by_election|turnout.json/.test(r))).toBe(false);
  await capture(page, "redesign-inicio-desktop");
});

test("D’Hondt: tres pasos, divisores, corte y cálculo completo sincronizados", async ({ page }) => {
  await page.goto("/");
  const lesson = page.getByRole("region", { name: "D’Hondt en tres pasos" });
  await expect(lesson).toContainText("León: 4 diputados");
  await lesson.getByRole("button", { name: /¿Cómo se calculan/ }).click();
  await lesson.getByRole("button", { name: "÷ 2", exact: true }).click();
  await expect(lesson).toContainText("46.289,00");
  await lesson.getByRole("button", { name: /¿Quién obtiene el último/ }).click();
  await expect(lesson).toContainText("Último diputado ✓");
  await lesson.getByText("Ver el cálculo completo", { exact: true }).click();
  await expect(lesson.getByRole("table")).toBeVisible();
  await page.goto("/?province=51");
  await expect(lesson).toContainText("Ceuta: 1 diputado");
  await expect(lesson).toContainText("no se aplica la barrera");
});

test("mínimos, adición, transferencia, edición y reinicio", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Candidatura para votos mínimos" }).selectOption("VOX - VOX");
  await expect(page.getByTestId("minimum-votes")).toContainText("10.839");
  await page.getByRole("combobox", { name: "Candidatura de destino" }).selectOption("VOX - VOX");
  const votes = page.getByRole("spinbutton", { name: "Cantidad de votos hipotéticos" });
  const result = page.getByRole("region", { name: "Resultado del escenario" });
  await votes.fill("10838");
  await expect(result).toContainText("No cambia el reparto");
  await votes.fill("10839");
  await expect(result).toContainText("VOX: 0 → 1");
  await page.getByRole("button", { name: "Transferir votos", exact: true }).click();
  await page.getByRole("combobox", { name: "Candidatura de origen" }).selectOption("PARTIDO POPULAR - PP");
  await page.getByRole("combobox", { name: "Candidatura de destino" }).selectOption("VOX - VOX");
  await votes.fill("20000");
  await expect(result).toContainText("275.240");
  await votes.fill("1000000000");
  await expect(page.getByRole("region", { name: "Calculadora de cambios hipotéticos" }).getByRole("alert")).toContainText("no supere los votos");
  await page.getByRole("button", { name: "Editar votos", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Votos manuales de VOX", exact: true }).fill("46290");
  await expect(result).toContainText("VOX: 0 → 1");
  await page.getByRole("button", { name: "Restablecer 2023" }).click();
  await expect(result).toContainText("No cambia el reparto");
});

test("tarjetas diversas abren directamente el escenario configurado", async ({ page }) => {
  await page.goto("/que-pasaria-si");
  await expect(page.getByRole("heading", { name: "¿Qué pasaría si cambiaran los votos?" })).toBeVisible();
  await expect(page.getByTestId("scenario-card")).toHaveCount(4);
  await capture(page, "redesign-escenarios-desktop");
  const card = page.getByTestId("scenario-card").first();
  await expect(card).toContainText("Su primer diputado");
  await card.getByRole("button", { name: "Abrir este escenario" }).click();
  await expect(page.locator("#scenario-title")).toBeFocused();
  await expect(page.getByRole("spinbutton", { name: "Cantidad de votos hipotéticos" })).not.toHaveValue("0");
  await expect(page.getByRole("region", { name: "Resultado del escenario" })).toContainText("Escenario hipotético");
  await page.getByLabel("Explorar ejemplos").selectOption("transfer");
  await page.getByTestId("scenario-card").first().getByRole("button").click();
  await expect(page.getByRole("button", { name: "Transferir votos", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Resultado del escenario" })).toContainText("275.240");
});

test("52 fichas, rutas retiradas y ausencia de archivos de sondeos", async ({ page, request }) => {
  const index = await (await request.get("/data/provinces/index.json")).json();
  expect(index).toHaveLength(52);
  let seats = 0;
  for (const p of index) {
    const response = await request.get(`/data/provinces/${p.code}.json`);
    expect(response.ok()).toBeTruthy(); seats += (await response.json()).seats2023;
  }
  expect(seats).toBe(350);
  for (const name of ["polls_2023", "polls_2026", "latest_polls", "campaign", "poll_sources"]) expect((await request.get(`/data/${name}.json`)).status()).toBe(404);
  for (const route of ["encuestas", "campana", "prediccion"]) {
    await page.goto(`/${route}`);
    await expect(page.getByRole("main")).not.toContainText(/Mi predicción|Últimas encuestas|CIS/);
  }
  await page.goto("/ultimo-escano?province=11");
  await expect(page.getByTestId("province-analysis")).toHaveAttribute("data-province", "11");
  await page.goto("/?province=99");
  await expect(page.getByTestId("province-analysis")).toHaveAttribute("data-province", "24");
});

test("móvil: navegación, selección provincial y escenarios sin desbordamiento", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const picker = page.getByRole("combobox", { name: "Tu provincia, tu último escaño" });
  await expect(picker).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, "redesign-inicio-mobile");
  await page.getByRole("button", { name: "Menú", exact: true }).click();
  await page.getByRole("link", { name: "¿Qué pasaría si…?", exact: true }).first().click();
  await expect(page.getByTestId("scenario-card")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, "redesign-escenarios-mobile");
  await picker.fill("Madrid"); await picker.press("Enter");
  await expect(page.getByTestId("province-analysis")).toHaveAttribute("data-province", "28");
  await expect(page.getByTestId("scenario-card").first()).toContainText("Madrid");
});

test("un error de datos permite reintentar", async ({ page }) => {
  let first = true;
  await page.route("**/data/provinces/28.json", async route => {
    if (first) { first = false; await route.fulfill({ status: 503, body: "temporal" }); } else await route.continue();
  });
  await page.goto("/?province=28");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("No se pudieron cargar");
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(page.getByTestId("province-analysis")).toHaveAttribute("data-province", "28");
});
