import { Back, Close } from "./components/Icon.jsx";

function highlight(text, query) {
  const value = String(text || "");
  const token = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0]
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!token) return value;
  let normalized = "";
  const sourcePositions = [];
  let sourceOffset = 0;
  Array.from(value).forEach((character) => {
    const part = character
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    normalized += part;
    for (let offset = 0; offset < part.length; offset += 1) {
      sourcePositions.push(sourceOffset);
    }
    sourceOffset += character.length;
  });
  const at = normalized.indexOf(token);
  if (at < 0) return value;
  const start = sourcePositions[at];
  const finalSourceIndex = sourcePositions[at + token.length - 1];
  const finalCharacter = value.codePointAt(finalSourceIndex);
  const end = finalSourceIndex + (finalCharacter > 0xffff ? 2 : 1);
  return (
    <>
      {value.slice(0, start)}
      <mark>{value.slice(start, end)}</mark>
      {value.slice(end)}
    </>
  );
}

export default function SearchPanel({
  open,
  close,
  inputRef,
  query,
  setQuery,
  type,
  setType,
  results,
  highlightIndex,
  setHighlightIndex,
  onChoose,
  recent,
  clearRecent,
}) {
  if (!open) return null;
  return (
    <div
      className="os-search-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <section className="os-search-dialog" role="dialog" aria-modal="true" aria-label="Search">
        <header className="search-panel-head">
          <button className="iconbtn" onClick={close} aria-label="Back"><Back /></button>
          <input
            ref={inputRef}
            autoFocus
            inputMode="search"
            placeholder="Search clients, services, payments…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlightIndex(0);
            }}
            aria-activedescendant={results[highlightIndex] ? `search-result-${highlightIndex}` : undefined}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setHighlightIndex((index) => Math.min(results.length - 1, index + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlightIndex((index) => Math.max(0, index - 1));
              } else if (event.key === "Enter" && results[highlightIndex]) {
                event.preventDefault();
                onChoose(results[highlightIndex]);
              }
            }}
          />
          {query && <button className="iconbtn" onClick={() => setQuery("")} aria-label="Clear"><Close /></button>}
          <button className="iconbtn search-desktop-close" onClick={close} aria-label="Close"><Close /></button>
        </header>
        <nav className="os-search-types">
          {["All", "Clients", "Services", "Payments", "Money"].map((item) => (
            <button className={type === item ? "active" : ""} key={item} onClick={() => setType(item)}>
              {item}
            </button>
          ))}
        </nav>
        <div className="os-search-results">
          {query && results.map((item, index) => (
            <button
              id={`search-result-${index}`}
              aria-selected={highlightIndex === index}
              className={highlightIndex === index ? "selected" : ""}
              key={`${item.type}-${item.id}-${item.clientId || ""}`}
              onClick={() => onChoose(item)}
            >
              <small>{item.type}</small>
              <b>{highlight(item.title, query)}</b>
              <span>{highlight(item.subtitle, query)}</span>
            </button>
          ))}
          {query && results.length === 0 && <p>No results found.</p>}
          {!query && recent.length > 0 && (
            <div className="search-recents">
              <header><b>Recent searches</b><button onClick={clearRecent}>Clear</button></header>
              {recent.map((item) => <button key={item} onClick={() => setQuery(item)}>{item}</button>)}
            </div>
          )}
          {!query && recent.length === 0 && <p>Search by client, service, amount, note, or number.</p>}
        </div>
      </section>
    </div>
  );
}
