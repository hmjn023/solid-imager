import tailwindcssAnimate from "tailwindcss-animate";
import plugin from "tailwindcss/plugin";

const mediaUtilities = plugin(({ addUtilities }) => {
	addUtilities({
		".virtualized-media-grid": {
			height: "var(--media-grid-height)",
		},
		".virtualized-media-row": {
			display: "grid",
			gridTemplateColumns: "repeat(var(--media-grid-columns), minmax(0, 1fr))",
			height: "var(--media-grid-row-height)",
			transform: "translateY(var(--media-grid-row-offset))",
		},
		".virtualized-combobox-list": {
			height: "var(--combobox-list-height)",
		},
		".virtualized-combobox-row": {
			height: "var(--combobox-row-height)",
			transform: "translateY(var(--combobox-row-offset))",
		},
		".media-viewer-aspect": {
			aspectRatio: "var(--media-aspect)",
		},
		".media-viewer-stage": {
			touchAction: "var(--media-touch-action)",
		},
		".media-viewer-transform": {
			transform:
				"translate3d(var(--media-pan-x), var(--media-pan-y), 0) scale(var(--media-zoom))",
			transitionDuration: "var(--media-transition-duration)",
		},
		".job-progress-fill": {
			width: "var(--job-progress-width)",
		},
		".upload-progress-fill": {
			width: "var(--upload-progress-width)",
		},
		".scrollbar-stable": {
			scrollbarGutter: "stable",
		},
		".bottom-safe": {
			bottom: "calc(1rem + env(safe-area-inset-bottom))",
		},
		".bottom-safe-sm": {
			bottom: "calc(1.5rem + env(safe-area-inset-bottom))",
		},
		".origin-kb-menu": {
			transformOrigin: "var(--kb-menu-content-transform-origin)",
		},
		".origin-kb-popover": {
			transformOrigin: "var(--kb-popover-content-transform-origin)",
		},
	});
});

/** @type {import('tailwindcss').Config} */
const solidUiPreset = {
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
		colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        error: {
          DEFAULT: "hsl(var(--error))",
          foreground: "hsl(var(--error-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
			card: {
				DEFAULT: "hsl(var(--card))",
				foreground: "hsl(var(--card-foreground))",
			},
		},
		aspectRatio: {
			landscape: "4 / 3",
			portrait: "3 / 4",
		},
		fontSize: {
			"label-xs": ["0.625rem", { lineHeight: "0.875rem" }],
			"label-sm": ["0.6875rem", { lineHeight: "1rem" }],
			micro: ["0.5625rem", { lineHeight: "0.75rem" }],
		},
		gridTemplateColumns: {
			"label-field": "5rem minmax(0, 1fr)",
			"settings-sidebar": "12rem minmax(0, 1fr)",
			"workspace-sidebar": "minmax(0, 1fr) clamp(20rem, 26vw, 26rem)",
			"detail-sidebar": "minmax(0, 1fr) 22rem",
			"manager-sidebar": "minmax(0, 1fr) 20rem",
			"compact-sidebar": "minmax(0, 1fr) 15rem",
			"media-table": "2fr 1fr 1fr 5rem",
			"entity-summary": "2fr 3fr 1fr",
			"content-action": "1fr auto",
			"thumbnail-content": "72px 1fr",
			"icon-content": "5rem 1fr",
			"about-layout": "minmax(0, 1.4fr) minmax(18rem, 0.6fr)",
			"server-settings": "1.2fr 0.8fr",
			"app-sidebar": "216px minmax(0, 1fr)",
			"app-sidebar-collapsed": "64px minmax(0, 1fr)",
			"sidebar-main": "300px 1fr",
		},
		gridTemplateRows: {
			"dialog-layout": "auto auto minmax(0, 1fr) auto",
		},
		width: {
			"dialog-inset": "calc(100% - 2rem)",
			"viewport-gutter": "calc(100dvw - 2rem)",
			"viewport-gutter-sm": "calc(100dvw - 4rem)",
			"popover-wide": "min(24rem, calc(100dvw - 2rem))",
			"popover-compact": "min(24rem, calc(100dvw - 1.5rem))",
			"popover-large": "min(28rem, calc(100dvw - 1.5rem))",
			"popover-medium": "min(20rem, calc(100% - 1rem))",
			"popover-small": "min(18rem, calc(100dvw - 2rem))",
			"popover-narrow": "min(28rem, calc(100% - 1rem))",
			"counter": "200px",
			"viewport-height": "100dvh",
		},
		minWidth: {
			"table-compact": "42rem",
			"table-standard": "46rem",
			"table-wide": "50rem",
			"table-extra-wide": "52rem",
			"popover-input": "min(16rem, 100%)",
		},
		minHeight: {
			"thumbnail-preview": "80px",
			"media-detail": "55dvh",
		},
		maxWidth: {
			"viewport-gutter": "calc(100dvw - 2rem)",
			"dialog-xs": "425px",
			"dialog-sm": "500px",
			"dialog-md": "560px",
			"dialog-lg": "600px",
			"dialog-xl": "900px",
			"dialog-reading": "28rem",
			"text-reading": "80ch",
			"text-compact": "42ch",
			"image-preview": "80%",
		},
		maxHeight: {
			"dialog-safe": "calc(100dvh - 2rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
			"dialog-screen": "calc(100dvh - 2rem)",
			"dialog-screen-sm": "calc(100dvh - 4rem)",
			"dialog-screen-compact": "calc(100dvh - 8rem)",
			"dialog-90vh": "90vh",
			"dialog-fit": "min(52rem, calc(100dvh - 2rem))",
			"popover-fit": "min(24rem, calc(100dvh - 2rem))",
			"popover-fit-available": "min(42rem, var(--kb-popper-content-available-height, calc(100dvh - 2rem)))",
			"menu-fit": "min(28rem, 60dvh)",
			"menu-tall": "min(32rem, 65dvh)",
			"menu-source": "min(36dvh, 22rem)",
			"menu-compact": "min(34dvh, 18rem)",
			"menu-medium": "min(32rem, 60dvh)",
			"menu-small": "min(28rem, 60dvh)",
			"list": "300px",
		},
		height: {
			"dialog-screen": "calc(100dvh - 2rem)",
			"viewer-stage": "min(32rem, 60dvh)",
			"viewer-panel": "min(32rem, 60dvh)",
		},
		zIndex: {
			"api-indicator": "60",
			"router-status": "70",
			"app-overlay": "80",
		},
		transitionProperty: {
			width: "width",
			grid: "grid-template-columns",
		},
		borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--kb-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--kb-accordion-content-height)" },
          to: { height: 0 },
        },
        "content-show": {
          from: { opacity: 0, transform: "scale(0.96)" },
          to: { opacity: 1, transform: "scale(1)" },
        },
        "content-hide": {
          from: { opacity: 1, transform: "scale(1)" },
          to: { opacity: 0, transform: "scale(0.96)" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "content-show": "content-show 0.2s ease-out",
        "content-hide": "content-hide 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate, mediaUtilities],
};

export default solidUiPreset;
