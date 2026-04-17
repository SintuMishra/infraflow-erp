const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const includesAny = (value, fragments) =>
  fragments.some((fragment) => value.includes(fragment));

const inferMaterialHsnSacCode = ({ materialName, category, rules = [] } = {}) => {
  const normalizedName = normalize(materialName);
  const normalizedCategory = normalize(category);
  const combined = `${normalizedName} ${normalizedCategory}`.trim();

  if (!combined) {
    return null;
  }

  for (const rule of rules) {
    const pattern = normalize(rule?.optionLabel);
    const code = normalize(rule?.optionValue).toUpperCase();

    if (!pattern || !code) {
      continue;
    }

    if (combined.includes(pattern)) {
      return {
        code,
        reason: `Matched configurable HSN/SAC rule for "${rule.optionLabel}"`,
      };
    }
  }

  if (includesAny(combined, ["cement", "opc", "ppc", "white cement"])) {
    return {
      code: "2523",
      reason: "Matched common cement materials",
    };
  }

  if (includesAny(combined, ["sand", "plaster sand", "river sand"])) {
    return {
      code: "2505",
      reason: "Matched natural or construction sand materials",
    };
  }

  if (
    includesAny(combined, [
      "aggregate",
      "agregate",
      "gravel",
      "crushed stone",
      "crusher dust",
      "stone dust",
      "dust",
      "gsb",
      "road metal",
      "metal",
    ])
  ) {
    return {
      code: "2517",
      reason: "Matched aggregates or crushed stone used in concrete or road works",
    };
  }

  if (includesAny(combined, ["tmt", "rebar", "reinforcement bar", "steel bar"])) {
    return {
      code: "7214",
      reason: "Matched reinforcement steel bars",
    };
  }

  if (includesAny(combined, ["brick", "fly ash brick", "clay brick"])) {
    return {
      code: "6901",
      reason: "Matched building bricks",
    };
  }

  return null;
};

module.exports = {
  inferMaterialHsnSacCode,
};
