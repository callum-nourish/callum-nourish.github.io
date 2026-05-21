const PALETTE_KEY = "palette"
const ATTR = "saved-palette"
const saved = localStorage.getItem(PALETTE_KEY) ?? "nourish"
document.documentElement.setAttribute(ATTR, saved)

document.addEventListener("nav", () => {
  const toggle = () => {
    const current = document.documentElement.getAttribute(ATTR) ?? "nourish"
    const next = current === "nourish" ? "flexoki" : "nourish"
    document.documentElement.setAttribute(ATTR, next)
    localStorage.setItem(PALETTE_KEY, next)
    // update button label
    for (const btn of document.getElementsByClassName("palette-toggle")) {
      btn.setAttribute("aria-label", next === "flexoki" ? "Switch to Nourish palette" : "Switch to Flexoki palette")
      const label = btn.querySelector(".palette-label")
      if (label) label.textContent = next === "flexoki" ? "Flexoki" : "Nourish"
    }
  }

  for (const btn of document.getElementsByClassName("palette-toggle")) {
    // set initial label
    const current = document.documentElement.getAttribute(ATTR) ?? "nourish"
    const label = btn.querySelector(".palette-label")
    if (label) label.textContent = current === "flexoki" ? "Flexoki" : "Nourish"
    btn.addEventListener("click", toggle)
    window.addCleanup(() => btn.removeEventListener("click", toggle))
  }
})
