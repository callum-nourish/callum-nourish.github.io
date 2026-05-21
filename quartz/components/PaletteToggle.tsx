// @ts-ignore
import paletteScript from "./scripts/palette.inline"
import paletteStyle from "./styles/palette.scss"
import { QuartzComponent, QuartzComponentConstructor } from "./types"

const PaletteToggle: QuartzComponent = () => {
  return (
    <button class="palette-toggle" aria-label="Switch palette">
      <span class="palette-label">Nourish</span>
    </button>
  )
}

PaletteToggle.beforeDOMLoaded = paletteScript
PaletteToggle.css = paletteStyle

export default (() => PaletteToggle) satisfies QuartzComponentConstructor
