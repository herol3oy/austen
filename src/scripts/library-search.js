import { searchText } from '../../shared/books.mjs';
const input = document.getElementById('library-search');
if (input) {
  const rows = [...document.querySelectorAll('[data-library-book]')], count = document.getElementById('library-count');
  const filter = () => {
    const words = searchText(input.value).split(' ').filter(Boolean); let shown = 0;
    for (const row of rows) { row.hidden = !words.every(word => row.dataset.search.includes(word)); if (!row.hidden) shown++; }
    count.textContent = `${shown.toLocaleString()} ${shown === 1 ? 'book' : 'books'}${words.length ? ' found' : ''}`;
  };
  input.addEventListener('input', filter); filter();
}
