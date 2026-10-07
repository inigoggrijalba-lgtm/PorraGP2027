// Familias tipográficas en uso (las define styles.css), para pintar con ellas las imágenes que se comparten.
export function families() {
  const css = getComputedStyle(document.documentElement);
  const read = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const display = read('--display', "'PG Saira Display', 'Arial Black', sans-serif");
  const title = read('--title', display);
  return {
    title: /^var\(/.test(title) ? display : title,
    display,
    cond: read('--cond', "'PG Saira Cond', 'Arial Narrow', sans-serif"),
    body: read('--body', "'PG Saira Text', 'Segoe UI', sans-serif"),
  };
}
