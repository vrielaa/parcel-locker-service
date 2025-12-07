/** @type {import('stylelint').Config} */
export default {
  extends: ["stylelint-config-standard-scss"],
  plugins: ["stylelint-order"],
  rules: {
    // klasy w stylu BEM: block__element--modifier
    "selector-class-pattern": [
      "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__(?:[a-z0-9]+(?:-[a-z0-9]+)*))*?(?:--(?:[a-z0-9]+(?:-[a-z0-9]+)*))*?$",
      {
        message:
          "Expected class selector to be BEM-like (block__element--modifier)",
      },
    ],

    // ta reguła bywa upierdliwa przy zagnieżdżeniach – wyłączamy
    "no-descending-specificity": null,

    // nie męczymy się z kebab-case w nazwach animacji/mixinów ani z map-get()
    "keyframes-name-pattern": null,
    "scss/at-mixin-pattern": null,
    "scss/no-global-function-names": null,

    // pozwalamy na min-device-pixel-ratio z kursu
    "media-feature-name-no-unknown": [
      true,
      { ignoreMediaFeatureNames: ["min-device-pixel-ratio"] },
    ],

    // kolejność bloków w SCSS
    "order/order": [
      "custom-properties",
      "dollar-variables",
      "declarations",
      "rules",
      "at-rules",
    ],

    // prosta kolejność właściwości – BEZ wymuszania pustych linii
    "order/properties-order": [
      // layout
      "display",
      "position",
      "top",
      "right",
      "bottom",
      "left",
      "z-index",

      // box model
      "box-sizing",
      "width",
      "min-width",
      "max-width",
      "height",
      "min-height",
      "max-height",
      "margin",
      "padding",
      "border",
      "border-radius",

      // overflow / opacity itp.
      "overflow",
      "opacity",

      // typography
      "font",
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
      "text-align",
      "text-transform",
      "letter-spacing",
      "color",

      // background / effects
      "background",
      "background-color",
      "background-image",
      "background-clip",
      "-webkit-background-clip",
      "box-shadow",

      // transforms / transitions / animations
      "transform",
      "transition",
      "animation",
    ],
  },
};
