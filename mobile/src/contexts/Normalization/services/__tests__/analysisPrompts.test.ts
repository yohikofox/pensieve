/**
 * Tests unitaires — filterIdeasContent
 *
 * Vérifie que les pistes opérationnelles (verbes d'exécution)
 * sont filtrées du texte brut retourné par le LLM.
 */

import { filterIdeasContent } from "../analysisPrompts";

describe("filterIdeasContent", () => {
  it("conserve les pistes produit valides", () => {
    const input = [
      "Piste : Le produit pourrait proposer une interface vocale simplifiée.",
      "Piste : Un positionnement orienté artisans et TPE.",
    ].join("\n");

    expect(filterIdeasContent(input)).toBe(input);
  });

  it("supprime les pistes qui commencent par 'analyser'", () => {
    const input = [
      "Piste : Le produit pourrait offrir une capture multi-modale.",
      "Piste : analyser les besoins des utilisateurs cibles.",
    ].join("\n");

    const result = filterIdeasContent(input);
    expect(result).toContain("Le produit pourrait offrir");
    expect(result).not.toContain("analyser les besoins");
  });

  it("supprime toutes les pistes avec verbes interdits", () => {
    const forbidden = [
      "Piste : analyser le marché.",
      "Piste : définir la cible.",
      "Piste : mettre en place un process.",
      "Piste : explorer les options.",
      "Piste : planifier le lancement.",
      "Piste : rechercher des partenaires.",
      "Piste : étudier la concurrence.",
    ];

    for (const line of forbidden) {
      expect(filterIdeasContent(line)).toBe("");
    }
  });

  it("gère le format avec tiret '- Piste :'", () => {
    const input = [
      "- Piste : Le produit pourrait intégrer un assistant vocal.",
      "- Piste : explorer différentes approches de monétisation.",
    ].join("\n");

    const result = filterIdeasContent(input);
    expect(result).toContain("Le produit pourrait intégrer");
    expect(result).not.toContain("explorer différentes");
  });

  it("conserve les lignes qui ne sont pas des pistes (ex: ligne vide, texte introductif)", () => {
    const input = [
      "Aucune piste de solution identifiable.",
      "",
      "Piste : Le produit pourrait cibler les artisans.",
    ].join("\n");

    const result = filterIdeasContent(input);
    expect(result).toContain("Aucune piste de solution identifiable.");
    expect(result).toContain("Le produit pourrait cibler");
  });

  it("est insensible à la casse du verbe interdit", () => {
    const input = "Piste : Analyser les retours utilisateurs.";
    expect(filterIdeasContent(input)).toBe("");
  });

  it("retourne une chaîne vide si toutes les pistes sont filtrées", () => {
    const input = [
      "Piste : analyser les données.",
      "Piste : planifier la roadmap.",
    ].join("\n");

    expect(filterIdeasContent(input)).toBe("");
  });
});
