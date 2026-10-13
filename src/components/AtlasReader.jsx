import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  List,
  Minus,
  Plus,
  Search,
  X,
} from "lucide-react";
import atlas from "../data/atlas.json";
import "./atlas-reader.css";

const OMITTED_ROLES = new Set([
  "title",
  "kicker",
  "pageNumber",
  "chapterNumber",
]);
const normalize = (value) =>
  value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ı/g, "i");
const searchIndex = atlas.slides.map((slide) =>
  normalize(
    `${slide.title}\n${slide.paragraphs.join("\n")}\n${slide.notes.join("\n")}`,
  ),
);
const chapterOf = (slide) =>
  atlas.chapters.find((chapter) => chapter.id === slide.chapterId);

function readBookmarks() {
  try {
    const stored = JSON.parse(
      localStorage.getItem("wow-atlas-bookmarks") || "[]",
    );
    return Array.isArray(stored)
      ? stored.filter(
          (number) =>
            Number.isInteger(number) &&
            number >= 1 &&
            number <= atlas.slides.length,
        )
      : [];
  } catch {
    return [];
  }
}

function snippet(slide, terms) {
  const paragraphs = slide.groups
    .filter((group) => !OMITTED_ROLES.has(group.role))
    .flatMap((group) => group.texts);
  const original =
    paragraphs.find((text) =>
      terms.some((term) => normalize(text).includes(term)),
    ) ||
    paragraphs.find((text) => text.length > 60) ||
    paragraphs[0] ||
    slide.title;
  const firstMatch = terms.length
    ? Math.max(0, normalize(original).indexOf(terms[0]))
    : 0;
  const start = Math.max(0, firstMatch - 42);
  return `${start ? "…" : ""}${original.slice(start, start + 156)}${original.length > start + 156 ? "…" : ""}`;
}

function SourceGroup({ group }) {
  if (group.role === "table") {
    const [header, ...rows] = group.tableRows;
    return (
      <div
        className="ar-table-scroll"
        data-source-group={group.id}
        tabIndex={0}
        role="region"
        aria-label="Hikâye tablosu, yatay kaydırılabilir"
      >
        <table>
          <thead>
            <tr>
              {header.map((cell, index) => (
                <th scope="col" key={index}>
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, column) => (
                  <td key={column}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const heading = /başlığı|Karakter adı|Dönem adı/.test(group.name);
  const label = /^(Etiket|Tarih|Karakter rolü|Dönem yılları)$/.test(group.name);
  const minor =
    /^(Not|Alt not|Tablo notu|Kapak alt notu|İstatistik etiketi)$/.test(
      group.name,
    );
  const statement = group.name === "Büyük ifade metni";
  const Tag = heading ? "h2" : "p";
  return (
    <div
      className={`ar-source-group${label ? " ar-label-group" : ""}${minor ? " ar-minor-group" : ""}${statement ? " ar-statement" : ""}`}
      data-source-group={group.id}
    >
      {group.texts.map((text, index) => (
        <Tag key={index}>{text}</Tag>
      ))}
    </div>
  );
}

function ArticleContent({ slide }) {
  const groups = slide.groups.filter((group) => !OMITTED_ROLES.has(group.role));
  const blocks = [];
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const next = groups[index + 1];
    if (
      (group.name === "İstatistik değeri" &&
        next?.name === "İstatistik etiketi") ||
      (group.name === "Değer" && next?.name === "Not")
    ) {
      blocks.push(
        <div className="ar-stat" key={group.id}>
          <div className="ar-stat-value" data-source-group={group.id}>
            {group.texts.map((text, i) => (
              <span key={i}>{text}</span>
            ))}
          </div>
          <SourceGroup group={next} />
        </div>,
      );
      index += 1;
    } else if (group.name === "Numara" && next?.name === "Sonuç metni") {
      blocks.push(
        <div className="ar-numbered" key={group.id}>
          <span className="ar-number" data-source-group={group.id}>
            {group.texts.join("\n")}
          </span>
          <SourceGroup group={next} />
        </div>,
      );
      index += 1;
    } else if (group.name === "Harf" && next?.name === "Karakter adı") {
      const character = [next];
      while (
        groups[index + 1 + character.length] &&
        /^(Karakter rolü|Karakter metni)$/.test(
          groups[index + 1 + character.length].name,
        )
      )
        character.push(groups[index + 1 + character.length]);
      blocks.push(
        <section className="ar-character" key={group.id}>
          <span className="ar-character-initial" data-source-group={group.id}>
            {group.texts.join("\n")}
          </span>
          <div>
            {character.map((item) => (
              <SourceGroup group={item} key={item.id} />
            ))}
          </div>
        </section>,
      );
      index += character.length;
    } else {
      blocks.push(<SourceGroup group={group} key={group.id} />);
    }
  }
  return <div className="ar-source-content">{blocks}</div>;
}

export default function AtlasReader({
  page,
  onPage,
  onClose,
  query = "",
  onQuery,
  focusSearch = false,
}) {
  const dialogRef = useRef(null);
  const searchRef = useRef(null);
  const articleRef = useRef(null);
  const titleRef = useRef(null);
  const previousPage = useRef(page);
  const initialFocus = useRef(focusSearch);
  const slide =
    atlas.slides[Math.max(0, Math.min(atlas.slides.length - 1, page - 1))];
  const chapter = chapterOf(slide);
  const [sidebarOpen, setSidebarOpen] = useState(focusSearch);
  const [isCompact, setIsCompact] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 800px)").matches,
  );
  const [expanded, setExpanded] = useState(() => new Set([slide.chapterId]));
  const [bookmarks, setBookmarks] = useState(readBookmarks);
  const [savedOnly, setSavedOnly] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [copyStatus, setCopyStatus] = useState("");
  const [manualLink, setManualLink] = useState("");
  const deferredQuery = useDeferredValue(query);
  const terms = useMemo(
    () => normalize(deferredQuery.trim()).split(/\s+/).filter(Boolean),
    [deferredQuery],
  );
  const matches = useMemo(
    () =>
      atlas.slides.filter(
        (item, index) =>
          (!savedOnly || bookmarks.includes(item.number)) &&
          terms.every((term) => searchIndex[index].includes(term)),
      ),
    [terms, savedOnly, bookmarks],
  );
  const isBookmarked = bookmarks.includes(slide.number);

  useEffect(() => {
    const dialog = dialogRef.current;
    const focusedBefore = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    const frame = requestAnimationFrame(() =>
      (initialFocus.current ? searchRef.current : titleRef.current)?.focus({
        preventScroll: true,
      }),
    );
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = oldOverflow;
      dialog.close();
      if (focusedBefore instanceof HTMLElement && focusedBefore.isConnected)
        focusedBefore.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    document.title = `${slide.title} · Warcraft Hikâye Atlası`;
    if (previousPage.current !== page) {
      previousPage.current = page;
      setExpanded((current) => new Set([...current, slide.chapterId]));
      articleRef.current?.scrollTo({ top: 0, behavior: "instant" });
      titleRef.current?.focus({ preventScroll: true });
      setManualLink("");
      setCopyStatus("");
    }
  }, [page, slide.chapterId, slide.title]);

  useEffect(() => {
    if (focusSearch) {
      const frame = requestAnimationFrame(() =>
        searchRef.current?.focus({ preventScroll: true }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [focusSearch]);

  useEffect(() => {
    if (!copyStatus) return;
    const timeout = window.setTimeout(() => setCopyStatus(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    const update = (event) => setIsCompact(event.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  function navigate(number) {
    onPage(number);
    setSidebarOpen(false);
  }

  function toggleBookmark() {
    const updated = isBookmarked
      ? bookmarks.filter((number) => number !== slide.number)
      : [...bookmarks, slide.number].sort((a, b) => a - b);
    setBookmarks(updated);
    try {
      localStorage.setItem("wow-atlas-bookmarks", JSON.stringify(updated));
    } catch {
      /* Reading remains available when browser storage is disabled. */
    }
  }

  async function copyLink() {
    const link = `${window.location.origin}${window.location.pathname}#atlas/${slide.number}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopyStatus("Sayfa bağlantısı kopyalandı.");
      setManualLink("");
    } catch {
      setCopyStatus("Bağlantıyı aşağıdaki alandan kopyalayabilirsiniz.");
      setManualLink(link);
    }
  }

  function toggleChapter(id) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleKeys(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      event.stopPropagation();
      setSidebarOpen(true);
      requestAnimationFrame(() => searchRef.current?.focus());
    }
    if (event.altKey && event.key === "ArrowLeft" && page > 1) {
      event.preventDefault();
      navigate(page - 1);
    }
    if (
      event.altKey &&
      event.key === "ArrowRight" &&
      page < atlas.slides.length
    ) {
      event.preventDefault();
      navigate(page + 1);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="ar-dialog"
      aria-labelledby="atlas-reader-heading"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={handleKeys}
    >
      <div className="ar-shell">
        <header className="ar-topbar">
          <div className="ar-topbar-start">
            <button
              type="button"
              className="ar-icon-button ar-menu-button"
              aria-label={sidebarOpen ? "Bölümleri kapat" : "Bölümleri aç"}
              aria-controls="ar-sidebar"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((value) => !value)}
            >
              <List size={20} />
            </button>
            <BookOpen size={20} aria-hidden="true" />
            <span>HİKÂYE ATLASI</span>
            <i aria-hidden="true" />
            <span className="ar-page-indicator">
              {String(slide.number).padStart(3, "0")}{" "}
              <span>/ {atlas.slides.length}</span>
            </span>
          </div>
          <button
            className="ar-close"
            type="button"
            aria-label="Atlası kapat"
            onClick={onClose}
          >
            <span>Atlası kapat</span>
            <X size={19} />
          </button>
        </header>
        <div className="ar-layout">
          {sidebarOpen && (
            <button
              type="button"
              tabIndex={-1}
              className="ar-sidebar-scrim"
              aria-label="Bölümleri kapat"
              onClick={() => {
                setSidebarOpen(false);
                requestAnimationFrame(() => titleRef.current?.focus());
              }}
            />
          )}
          <aside
            id="ar-sidebar"
            className={`ar-sidebar${sidebarOpen ? " ar-sidebar-open" : ""}`}
            aria-label="Atlas bölümleri ve arama"
          >
            <div className="ar-sidebar-header">
              <div className="ar-sidebar-caption">
                <span>KOLEKSİYON</span>
                <span>{atlas.chapters.length} bölüm</span>
              </div>
              <label className="ar-search">
                <Search size={17} aria-hidden="true" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => onQuery(event.target.value)}
                  placeholder="Bir karakter, olay veya dönem…"
                  aria-label="Atlasın tamamında ara"
                  type="search"
                  autoComplete="off"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Aramayı temizle"
                    onClick={() => {
                      onQuery("");
                      searchRef.current?.focus();
                    }}
                  >
                    <X size={15} />
                  </button>
                )}
              </label>
              <div className="ar-sidebar-tabs" aria-label="İçerik filtresi">
                <button
                  type="button"
                  aria-pressed={!savedOnly}
                  onClick={() => setSavedOnly(false)}
                >
                  Tüm içerik
                </button>
                <button
                  type="button"
                  aria-pressed={savedOnly}
                  onClick={() => setSavedOnly(true)}
                >
                  <Bookmark size={13} /> Kaydedilenler{" "}
                  <span>{bookmarks.length}</span>
                </button>
              </div>
            </div>
            <div className="ar-toc-scroll">
              {terms.length > 0 || savedOnly ? (
                <div className="ar-results">
                  <p
                    className="ar-result-count"
                    role="status"
                    aria-live="polite"
                  >
                    {matches.length} {savedOnly ? "kayıtlı sayfa" : "sonuç"}
                    {deferredQuery ? ` · “${deferredQuery}”` : ""}
                  </p>
                  {matches.length ? (
                    matches.map((result) => (
                      <button
                        type="button"
                        key={result.number}
                        className={`ar-result${result.number === slide.number ? " ar-current" : ""}`}
                        onClick={() => navigate(result.number)}
                        aria-current={
                          result.number === slide.number ? "page" : undefined
                        }
                      >
                        <span className="ar-result-meta">
                          {chapterOf(result).title}{" "}
                          <span>{String(result.number).padStart(3, "0")}</span>
                        </span>
                        <strong>{result.title}</strong>
                        <span className="ar-result-snippet">
                          {snippet(result, terms)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="ar-empty">
                      <Search size={25} aria-hidden="true" />
                      <h3>
                        {savedOnly
                          ? "Henüz kayıtlı sayfa yok"
                          : "Bu aramada sonuç yok"}
                      </h3>
                      <p>
                        {savedOnly
                          ? "Bir sayfayı kaydetmek için okuma alanındaki yer imi düğmesini kullanın."
                          : "Farklı bir karakter adı veya daha kısa bir kelime deneyin."}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <nav aria-label="Bölüm ve sayfa dizini">
                  {atlas.chapters.map((item) => (
                    <section className="ar-chapter" key={item.id}>
                      <button
                        className={`ar-chapter-button${item.id === chapter.id ? " ar-active-chapter" : ""}`}
                        type="button"
                        aria-expanded={expanded.has(item.id)}
                        aria-controls={`ar-chapter-${item.id}`}
                        onClick={() => toggleChapter(item.id)}
                      >
                        <span className="ar-chapter-number">
                          {item.index < 0
                            ? "—"
                            : String(item.index).padStart(2, "0")}
                        </span>
                        <span>
                          {item.title}
                          <small>{item.period}</small>
                        </span>
                        {expanded.has(item.id) ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </button>
                      {expanded.has(item.id) && (
                        <ol
                          id={`ar-chapter-${item.id}`}
                          className="ar-chapter-pages"
                        >
                          {atlas.slides
                            .slice(item.start - 1, item.end)
                            .map((itemSlide) => (
                              <li key={itemSlide.number}>
                                <button
                                  type="button"
                                  className={
                                    itemSlide.number === slide.number
                                      ? "ar-current"
                                      : ""
                                  }
                                  onClick={() => navigate(itemSlide.number)}
                                  aria-current={
                                    itemSlide.number === slide.number
                                      ? "page"
                                      : undefined
                                  }
                                >
                                  <span>
                                    {String(itemSlide.number).padStart(3, "0")}
                                  </span>
                                  {itemSlide.title}
                                  {bookmarks.includes(itemSlide.number) && (
                                    <Bookmark
                                      size={11}
                                      aria-label="Kaydedildi"
                                    />
                                  )}
                                </button>
                              </li>
                            ))}
                        </ol>
                      )}
                    </section>
                  ))}
                </nav>
              )}
            </div>
            <div className="ar-sidebar-footer">
              <span>Vanilla’dan The Last Titan’a</span>
              <kbd>Ctrl K</kbd>
            </div>
          </aside>
          <main
            className="ar-reading-scroll"
            ref={articleRef}
            id="ar-reading-area"
            inert={isCompact && sidebarOpen}
          >
            <div className="ar-reading-tools">
              <div className="ar-breadcrumb">
                <span>{chapter.title}</span>
                <ChevronRight size={12} aria-hidden="true" />
                <span>
                  {slide.number - chapter.start + 1} /{" "}
                  {chapter.end - chapter.start + 1}
                </span>
              </div>
              <div className="ar-tool-buttons">
                <div className="ar-font-controls" aria-label="Metin boyutu">
                  <button
                    type="button"
                    aria-label="Metni küçült"
                    disabled={fontSize <= 16}
                    onClick={() =>
                      setFontSize((size) => Math.max(16, size - 2))
                    }
                  >
                    <Minus size={14} />
                  </button>
                  <span
                    aria-live="polite"
                    aria-label={`Yazı boyutu ${fontSize} piksel`}
                  >
                    Aa
                  </span>
                  <button
                    type="button"
                    aria-label="Metni büyüt"
                    disabled={fontSize >= 24}
                    onClick={() =>
                      setFontSize((size) => Math.min(24, size + 2))
                    }
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  className={`ar-icon-button${isBookmarked ? " ar-is-saved" : ""}`}
                  aria-label={
                    isBookmarked ? "Kaydedilenlerden kaldır" : "Sayfayı kaydet"
                  }
                  aria-pressed={isBookmarked}
                  onClick={toggleBookmark}
                >
                  <Bookmark
                    size={18}
                    fill={isBookmarked ? "currentColor" : "none"}
                  />
                </button>
                <button
                  type="button"
                  className="ar-icon-button"
                  aria-label="Sayfa bağlantısını kopyala"
                  onClick={copyLink}
                >
                  {copyStatus.startsWith("Sayfa") ? (
                    <Check size={18} />
                  ) : (
                    <Copy size={18} />
                  )}
                </button>
              </div>
            </div>
            <div className="ar-copy-status" role="status" aria-live="polite">
              {copyStatus}
            </div>
            {manualLink && (
              <label className="ar-manual-copy">
                Sayfa bağlantısı
                <input
                  value={manualLink}
                  readOnly
                  onFocus={(event) => event.target.select()}
                  aria-label="Kopyalanacak sayfa bağlantısı"
                />
              </label>
            )}
            <article
              className="ar-article"
              style={{ "--ar-text-size": `${fontSize}px` }}
              key={slide.number}
            >
              <header className="ar-article-header">
                <p className="ar-eyebrow">
                  {slide.kicker ||
                    `${String(chapter.index < 0 ? 0 : chapter.index).padStart(2, "0")} · ${chapter.period}`}
                </p>
                <h1 id="atlas-reader-heading" ref={titleRef} tabIndex={-1}>
                  {slide.title}
                </h1>
                <div className="ar-title-rule">
                  <span />
                </div>
              </header>
              <ArticleContent slide={slide} />
              {slide.images.length > 0 && (
                <div className="ar-source-icons" aria-hidden="true">
                  {slide.images.map((image, index) => (
                    <img
                      key={`${image.src}-${index}`}
                      src={image.src}
                      alt=""
                      width={36}
                      height={36}
                      loading="lazy"
                    />
                  ))}
                </div>
              )}
              {slide.notes.length > 0 && (
                <aside className="ar-notes" aria-label="Sunum notları">
                  <h2>Sunum notu</h2>
                  {slide.notes.map((note, index) => (
                    <p key={index}>{note}</p>
                  ))}
                </aside>
              )}
              {slide.links.filter(
                (link) =>
                  /^https?:\/\//.test(link.url) && !/[<>…]/.test(link.url),
              ).length > 0 && (
                <aside className="ar-source-links">
                  <h2>Kaynak bağlantıları</h2>
                  <ul>
                    {slide.links
                      .filter(
                        (link) =>
                          /^https?:\/\//.test(link.url) &&
                          !/[<>…]/.test(link.url),
                      )
                      .map((link, index) => (
                        <li key={`${link.url}-${index}`}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {link.text}
                            <ExternalLink
                              size={13}
                              aria-label="Yeni sekmede açılır"
                            />
                          </a>
                        </li>
                      ))}
                  </ul>
                </aside>
              )}
              <footer className="ar-article-footer">
                <span>HİKÂYE ATLASI</span>
                <span>{String(slide.number).padStart(3, "0")}</span>
              </footer>
              <nav
                className="ar-pagination"
                aria-label="Sayfalar arasında gezinme"
              >
                <button
                  type="button"
                  disabled={slide.number === 1}
                  onClick={() => navigate(slide.number - 1)}
                >
                  <ArrowLeft size={18} />
                  <span>
                    <small>ÖNCEKİ SAYFA</small>
                    {atlas.slides[slide.number - 2]?.title ||
                      "Atlasın başlangıcı"}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={slide.number === atlas.slides.length}
                  onClick={() => navigate(slide.number + 1)}
                >
                  <span>
                    <small>SONRAKİ SAYFA</small>
                    {atlas.slides[slide.number]?.title || "Atlasın sonu"}
                  </span>
                  <ArrowRight size={18} />
                </button>
              </nav>
            </article>
          </main>
        </div>
      </div>
    </dialog>
  );
}
