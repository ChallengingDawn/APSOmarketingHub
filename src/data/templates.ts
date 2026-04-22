export type TextAlign = "left" | "center" | "right";

export type TextField = {
  id: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  multiline?: boolean;
  maxLines?: number;
  // Canvas coordinates in template native pixels
  x: number;
  y: number;
  maxWidth: number;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  lineHeight: number; // multiplier of fontSize
  color: string;
  align?: TextAlign;
  uppercase?: boolean;
  letterSpacing?: number;
  // Optional cover rect painted under the text. Use a brand colour to wipe a
  // baked-in placeholder, or a semi-transparent rgba() to scrim text on a photo.
  // Leave undefined when the text reads on the bg as-is.
  cover?: { x: number; y: number; w: number; h: number; color: string };
  // Optional drop-shadow for legibility on photos. Used when the template
  // accepts a photoSlot and the text overlays the image without an opaque cover.
  textShadow?: { color: string; blur: number; offsetX?: number; offsetY?: number };
};

export type PhotoSlot = {
  x: number;
  y: number;
  w: number;
  h: number;
  // "cloud" clips the photo inside the visible cloud shape; "rect" is a simple box.
  mask?: "cloud" | "rect";
};

export type CoverRegion = { x: number; y: number; w: number; h: number; color: string };

export type TemplateSpec = {
  id: string;
  name: string;
  category: "LinkedIn event" | "Email signature";
  description: string;
  src: string;
  width: number;
  height: number;
  // Big background cover blocks painted AFTER bg image, BEFORE photo. Use to
  // wipe out the baked-in placeholder text and provide a flat fallback when
  // the user has not uploaded a photo.
  coverRegions?: CoverRegion[];
  // Painted AFTER the photo but BEFORE the text fields. Use for ONE big
  // semi-transparent text scrim that spans every text band — replaces fragile
  // per-field scrim rects with gaps between them.
  photoOverlays?: CoverRegion[];
  fields: TextField[];
  photoSlot?: PhotoSlot;
};

// Fonts: we use what MUI ships by default (Outfit / Inter fall back to sans-serif).
// APSOparts templates are set in a geometric sans close to "Futura" or "Outfit".
const HEAD_FONT = "'Outfit', 'Segoe UI', Arial, sans-serif";
const BODY_FONT = "'Outfit', 'Segoe UI', Arial, sans-serif";

const SKY_LIGHT = "#d9e7f1";
const GREEN_DARK = "#788d2c";
const GREEN_LIGHT = "#a3bf5c";
const WHITE = "#ffffff";
const APSO_RED = "#ed1b2f";

export const TEMPLATES: TemplateSpec[] = [
  {
    id: "save-the-date-light",
    name: "Save The Date — Light",
    category: "LinkedIn event",
    description: "Photo fills canvas. Green SAVE THE DATE block stays opaque; bottom text overlays on a scrim.",
    src: "/templates/save-the-date-light.jpg",
    width: 1200,
    height: 1200,
    coverRegions: [
      { x: 0, y: 0, w: 1200, h: 1200, color: GREEN_LIGHT },
    ],
    // ONE continuous bottom scrim covers all bottom text in a single band —
    // no gaps, no striping.
    photoOverlays: [
      { x: 0, y: 620, w: 1200, h: 580, color: "rgba(0,0,0,0.5)" },
    ],
    fields: [
      {
        id: "title",
        label: "Main title",
        defaultValue: "SAVE\nTHE DATE",
        multiline: true,
        maxLines: 2,
        x: 80,
        y: 275,
        maxWidth: 900,
        fontFamily: HEAD_FONT,
        fontWeight: 800,
        fontSize: 135,
        lineHeight: 1.0,
        color: WHITE,
        uppercase: true,
        // Opaque GREEN_LIGHT block painted AFTER the photo at field-render
        // time — keeps the iconic SAVE THE DATE block visible even when a
        // photo fills the rest of the canvas.
        cover: { x: 60, y: 255, w: 920, h: 340, color: GREEN_LIGHT },
      },
      {
        id: "headline",
        label: "Event headline",
        defaultValue: "THIS IS THE EVENT\nHEADLINE",
        multiline: true,
        maxLines: 2,
        x: 80,
        y: 680,
        maxWidth: 1040,
        fontFamily: HEAD_FONT,
        fontWeight: 800,
        fontSize: 76,
        lineHeight: 1.05,
        color: WHITE,
        uppercase: true,
      },
      {
        id: "dateTime",
        label: "Date & time",
        defaultValue: "Date & time",
        x: 80,
        y: 870,
        maxWidth: 1040,
        fontFamily: BODY_FONT,
        fontWeight: 700,
        fontSize: 40,
        lineHeight: 1.1,
        color: WHITE,
      },
      {
        id: "sub",
        label: "Subheadline",
        defaultValue: "Subheadline - Max. 2 lines\nShort explanation or context",
        multiline: true,
        maxLines: 2,
        x: 80,
        y: 950,
        maxWidth: 1040,
        fontFamily: BODY_FONT,
        fontWeight: 400,
        fontSize: 34,
        lineHeight: 1.3,
        color: WHITE,
      },
    ],
    photoSlot: { x: 0, y: 0, w: 1200, h: 1200, mask: "rect" },
  },
  {
    id: "save-the-date-dark",
    name: "Save The Date — Dark",
    category: "LinkedIn event",
    description: "Photo fills canvas. Dark green SAVE THE DATE block stays opaque; bottom text overlays on a stronger scrim.",
    src: "/templates/save-the-date-dark.jpg",
    width: 1200,
    height: 1200,
    coverRegions: [
      { x: 0, y: 0, w: 1200, h: 1200, color: GREEN_DARK },
    ],
    photoOverlays: [
      { x: 0, y: 620, w: 1200, h: 580, color: "rgba(0,0,0,0.6)" },
    ],
    fields: [
      {
        id: "title",
        label: "Main title",
        defaultValue: "SAVE\nTHE DATE",
        multiline: true,
        maxLines: 2,
        x: 80,
        y: 280,
        maxWidth: 900,
        fontFamily: HEAD_FONT,
        fontWeight: 800,
        fontSize: 135,
        lineHeight: 1.0,
        color: WHITE,
        uppercase: true,
        cover: { x: 60, y: 255, w: 920, h: 340, color: GREEN_DARK },
      },
      {
        id: "headline",
        label: "Event headline",
        defaultValue: "THIS IS THE EVENT\nHEADLINE",
        multiline: true,
        maxLines: 2,
        x: 80,
        y: 680,
        maxWidth: 1040,
        fontFamily: HEAD_FONT,
        fontWeight: 800,
        fontSize: 76,
        lineHeight: 1.05,
        color: WHITE,
        uppercase: true,
      },
      {
        id: "dateTime",
        label: "Date & time",
        defaultValue: "Date & time",
        x: 80,
        y: 870,
        maxWidth: 1040,
        fontFamily: BODY_FONT,
        fontWeight: 700,
        fontSize: 40,
        lineHeight: 1.1,
        color: WHITE,
      },
      {
        id: "sub",
        label: "Subheadline",
        defaultValue: "Subheadline - Max. 2 lines\nShort explanation or context",
        multiline: true,
        maxLines: 2,
        x: 80,
        y: 950,
        maxWidth: 1040,
        fontFamily: BODY_FONT,
        fontWeight: 400,
        fontSize: 34,
        lineHeight: 1.3,
        color: WHITE,
      },
    ],
    photoSlot: { x: 0, y: 0, w: 1200, h: 1200, mask: "rect" },
  },
  {
    id: "event-teaser-dark",
    name: "Event Teaser — Dark",
    category: "LinkedIn event",
    description: "Photo fills canvas. Headline + date + sub overlay on a soft scrim, white text with shadow.",
    src: "/templates/event-teaser-dark.jpg",
    width: 1200,
    height: 1200,
    coverRegions: [
      { x: 0, y: 0, w: 1200, h: 1200, color: SKY_LIGHT },
    ],
    photoOverlays: [
      { x: 0, y: 250, w: 1200, h: 510, color: "rgba(0,0,0,0.45)" },
    ],
    fields: [
      {
        id: "headline",
        label: "Event headline",
        defaultValue: "THIS IS THE\nEVENT HEADLINE",
        multiline: true,
        maxLines: 2,
        x: 80,
        y: 295,
        maxWidth: 1040,
        fontFamily: HEAD_FONT,
        fontWeight: 800,
        fontSize: 82,
        lineHeight: 1.05,
        color: WHITE,
        uppercase: true,
        textShadow: { color: "rgba(0,0,0,0.55)", blur: 12 },
      },
      {
        id: "dateTime",
        label: "Date & time",
        defaultValue: "Date & time",
        x: 80,
        y: 540,
        maxWidth: 1040,
        fontFamily: BODY_FONT,
        fontWeight: 700,
        fontSize: 40,
        lineHeight: 1.1,
        color: WHITE,
        textShadow: { color: "rgba(0,0,0,0.55)", blur: 8 },
      },
      {
        id: "sub",
        label: "Subheadline",
        defaultValue: "Subheadline - Max. 2 lines\nShort explanation or context",
        multiline: true,
        maxLines: 2,
        x: 80,
        y: 625,
        maxWidth: 1040,
        fontFamily: BODY_FONT,
        fontWeight: 400,
        fontSize: 34,
        lineHeight: 1.3,
        color: WHITE,
        textShadow: { color: "rgba(0,0,0,0.55)", blur: 8 },
      },
    ],
    photoSlot: { x: 0, y: 0, w: 1200, h: 1200, mask: "rect" },
  },
  {
    id: "event-recap-light",
    name: "Event Recap — Light",
    category: "LinkedIn event",
    description: "Photo fills the canvas; white headline + sub overlay on a soft dark scrim.",
    src: "/templates/event-recap-light.jpg",
    width: 1200,
    height: 1200,
    coverRegions: [
      { x: 0, y: 0, w: 1200, h: 1200, color: GREEN_LIGHT },
    ],
    photoOverlays: [
      { x: 0, y: 820, w: 1200, h: 380, color: "rgba(0,0,0,0.5)" },
    ],
    fields: [
      {
        id: "headline",
        label: "Event headline",
        defaultValue: "EVENT RECAP",
        x: 80,
        y: 900,
        maxWidth: 1040,
        fontFamily: HEAD_FONT,
        fontWeight: 800,
        fontSize: 100,
        lineHeight: 1.05,
        color: WHITE,
        uppercase: true,
      },
      {
        id: "sub",
        label: "Subheadline",
        defaultValue: "Subheadline - Max. 2 lines\nShort explanation or context",
        multiline: true,
        maxLines: 2,
        x: 80,
        y: 1005,
        maxWidth: 1040,
        fontFamily: BODY_FONT,
        fontWeight: 400,
        fontSize: 36,
        lineHeight: 1.3,
        color: WHITE,
      },
    ],
    photoSlot: { x: 0, y: 0, w: 1200, h: 1200, mask: "rect" },
  },
  {
    id: "event-recap-dark",
    name: "Event Recap — Dark",
    category: "LinkedIn event",
    description: "Photo fills the canvas; white headline + sub overlay on a stronger dark scrim.",
    src: "/templates/event-recap-dark.jpg",
    width: 1200,
    height: 1200,
    coverRegions: [
      { x: 0, y: 0, w: 1200, h: 1200, color: GREEN_DARK },
    ],
    photoOverlays: [
      { x: 0, y: 820, w: 1200, h: 380, color: "rgba(0,0,0,0.6)" },
    ],
    fields: [
      {
        id: "headline",
        label: "Event headline",
        defaultValue: "EVENT RECAP",
        x: 80,
        y: 900,
        maxWidth: 1040,
        fontFamily: HEAD_FONT,
        fontWeight: 800,
        fontSize: 100,
        lineHeight: 1.05,
        color: WHITE,
        uppercase: true,
      },
      {
        id: "sub",
        label: "Subheadline",
        defaultValue: "Subheadline - Max. 2 lines\nShort explanation or context",
        multiline: true,
        maxLines: 2,
        x: 80,
        y: 1005,
        maxWidth: 1040,
        fontFamily: BODY_FONT,
        fontWeight: 400,
        fontSize: 36,
        lineHeight: 1.3,
        color: WHITE,
      },
    ],
    photoSlot: { x: 0, y: 0, w: 1200, h: 1200, mask: "rect" },
  },
  {
    id: "post-event-highlight",
    name: "Post-Event Highlight",
    category: "LinkedIn event",
    description: "Green hills top, bold red band bottom with headline in white.",
    src: "/templates/post-event-highlight.jpg",
    width: 1200,
    height: 1200,
    coverRegions: [
      { x: 0, y: 760, w: 1200, h: 440, color: APSO_RED },
    ],
    fields: [
      {
        id: "headline",
        label: "Event headline",
        defaultValue: "THIS IS THE\nEVENT HEADLINE",
        multiline: true,
        maxLines: 2,
        x: 80,
        y: 820,
        maxWidth: 1040,
        fontFamily: HEAD_FONT,
        fontWeight: 800,
        fontSize: 90,
        lineHeight: 1.05,
        color: WHITE,
        uppercase: true,
        cover: { x: 60, y: 790, w: 1060, h: 230, color: APSO_RED },
      },
      {
        id: "sub",
        label: "Subheadline",
        defaultValue: "Subheadline - Max. 2 lines\nShort explanation or context",
        multiline: true,
        maxLines: 2,
        x: 80,
        y: 1040,
        maxWidth: 1040,
        fontFamily: BODY_FONT,
        fontWeight: 400,
        fontSize: 34,
        lineHeight: 1.3,
        color: WHITE,
        cover: { x: 60, y: 1020, w: 1060, h: 130, color: APSO_RED },
      },
    ],
    photoSlot: { x: 0, y: 0, w: 1200, h: 720, mask: "rect" },
  },
  {
    id: "sig-option-1",
    name: "Email Signature — Option 1",
    category: "Email signature",
    description: "Left landscape, right red band with CTA button.",
    src: "/templates/sig-option-1.jpg",
    width: 800,
    height: 250,
    coverRegions: [
      { x: 270, y: 0, w: 530, h: 250, color: APSO_RED },
    ],
    fields: [
      {
        id: "headline",
        label: "Headline",
        defaultValue: "THIS IS THE HEADLINE",
        x: 285,
        y: 52,
        maxWidth: 470,
        fontFamily: HEAD_FONT,
        fontWeight: 800,
        fontSize: 26,
        lineHeight: 1.1,
        color: WHITE,
        uppercase: true,
        cover: { x: 275, y: 32, w: 495, h: 38, color: APSO_RED },
      },
      {
        id: "title",
        label: "Title",
        defaultValue: "This is the title",
        x: 285,
        y: 92,
        maxWidth: 470,
        fontFamily: BODY_FONT,
        fontWeight: 500,
        fontSize: 22,
        lineHeight: 1.1,
        color: WHITE,
        cover: { x: 275, y: 75, w: 495, h: 32, color: APSO_RED },
      },
      {
        id: "subtitle",
        label: "Subtitle",
        defaultValue: "SUBTITLE",
        x: 285,
        y: 120,
        maxWidth: 470,
        fontFamily: BODY_FONT,
        fontWeight: 700,
        fontSize: 14,
        lineHeight: 1.1,
        color: WHITE,
        uppercase: true,
        letterSpacing: 2,
        cover: { x: 275, y: 108, w: 495, h: 22, color: APSO_RED },
      },
      {
        id: "cta",
        label: "Call to action",
        defaultValue: "Call to Action →",
        x: 310,
        y: 177,
        maxWidth: 300,
        fontFamily: BODY_FONT,
        fontWeight: 700,
        fontSize: 18,
        lineHeight: 1.0,
        color: APSO_RED,
        cover: { x: 285, y: 155, w: 220, h: 42, color: WHITE },
      },
    ],
  },
  {
    id: "sig-option-2",
    name: "Email Signature — Option 2",
    category: "Email signature",
    description: "Full red bar, left big headline, right title + CTA.",
    src: "/templates/sig-option-2.jpg",
    width: 800,
    height: 250,
    coverRegions: [
      { x: 0, y: 60, w: 800, h: 140, color: APSO_RED },
    ],
    fields: [
      {
        id: "headline",
        label: "Big headline",
        defaultValue: "THIS IS AN\nEXAMPLE HEADLINE",
        multiline: true,
        maxLines: 2,
        x: 30,
        y: 98,
        maxWidth: 470,
        fontFamily: HEAD_FONT,
        fontWeight: 800,
        fontSize: 40,
        lineHeight: 1.0,
        color: WHITE,
        uppercase: true,
        cover: { x: 20, y: 65, w: 485, h: 110, color: APSO_RED },
      },
      {
        id: "title",
        label: "Title",
        defaultValue: "This is the title",
        x: 520,
        y: 88,
        maxWidth: 260,
        fontFamily: BODY_FONT,
        fontWeight: 500,
        fontSize: 22,
        lineHeight: 1.1,
        color: WHITE,
        cover: { x: 510, y: 70, w: 280, h: 32, color: APSO_RED },
      },
      {
        id: "subtitle",
        label: "Subtitle",
        defaultValue: "SUBTITLE",
        x: 520,
        y: 118,
        maxWidth: 260,
        fontFamily: BODY_FONT,
        fontWeight: 700,
        fontSize: 14,
        lineHeight: 1.1,
        color: WHITE,
        uppercase: true,
        letterSpacing: 2,
        cover: { x: 510, y: 105, w: 280, h: 22, color: APSO_RED },
      },
      {
        id: "cta",
        label: "Call to action",
        defaultValue: "Call to Action →",
        x: 540,
        y: 173,
        maxWidth: 240,
        fontFamily: BODY_FONT,
        fontWeight: 700,
        fontSize: 18,
        lineHeight: 1.0,
        color: APSO_RED,
        cover: { x: 515, y: 150, w: 220, h: 42, color: WHITE },
      },
    ],
  },
];