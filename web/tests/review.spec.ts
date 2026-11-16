import { test, expect } from "@playwright/test";

test.afterEach(async ({ page }) => { expect(await page.pageErrors()).toEqual([]); });

test("revisión: calculadora histórica y mapa operativos", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("province-analysis")).toHaveAttribute("data-province", "24");
  await expect(page.getByRole("status").filter({ hasText: "Revisión limitada" })).toBeVisible();
  await page.getByRole("combobox", { name: "Candidatura para votos mínimos" }).selectOption("VOX - VOX");
  await expect(page.getByTestId("minimum-votes")).toContainText("10.839");
  await page.goto("/provincias");
  await expect(page.getByTestId("mapa-provincias").locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Seleccionar Ceuta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ceuta", exact: true })).toBeVisible();
  await page.goto("/ultimo-escano?province=11");
  await expect(page.getByTestId("province-analysis")).toHaveAttribute("data-province", "11");
  await page.goto("/que-pasaria-si");
  await expect(page.getByTestId("scenario-card")).toHaveCount(2);
  await expect(page.getByTestId("scenario-card").first()).toContainText("Cambio histórico observado");
});

test("no se sirven encuestas, derivados ni modelos por URL directa o heredada", async ({ page, request }) => {
  for (const route of ["/encuestas", "/campana", "/simulador", "/laboratorio-ml", "/metodologia", "/metodologia/modelos"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: "Contenido no incluido en la revisión" })).toBeVisible();
    await expect(page.getByTestId("latest-poll")).toHaveCount(0);
  }
  await page.goto("/prediccion");
  await expect(page.getByRole("main")).not.toContainText("Mi predicción");
  for (const name of ["polls_2023", "polls_2026", "latest_polls", "campaign", "poll_sources", "publication_status", "ml", "ml_gate", "model_registry", "oos_map"]) {
    expect((await request.get(`/data/${name}.json`)).status()).toBe(404);
  }
  const atlas = await (await request.get("/data/simulator.json")).json();
  expect(Object.keys(atlas).sort()).toEqual(["parties", "provinces"]);
  expect(atlas.provinces).toHaveLength(52);
  expect(atlas.provinces[0]).not.toHaveProperty("baseline_votes");
  expect((await (await request.get("/robots.txt")).text())).toContain("Disallow: /");
});
