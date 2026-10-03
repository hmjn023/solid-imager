// Bun 1.4.2 can deadlock on sharp.metadata() when Nitro loads the native
// binding after the rest of the production bundle. Load it before the entry.
import "sharp";
