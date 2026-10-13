import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Compass,
  Menu,
  Pause,
  Play,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import catalog from "./data/catalog.json";

const ArcaneScene = lazy(() => import("./components/ArcaneScene"));
const AtlasReader = lazy(() => import("./components/AtlasReader"));
const eras = catalog.chapters.filter((c) => c.index >= 0 && c.index <= 13);
const colors = [
  "#bfaa74",
  "#c6a566",
  "#93ae79",
  "#8ac1d1",
  "#cd8666",
  "#7fac9c",
  "#b48a69",
  "#a3b87b",
  "#b59064",
  "#89a9be",
  "#b69b81",
  "#c59c77",
  "#ab96cb",
  "#abbdc6",
];
const shortNames = [
  "Önsöz",
  "Vanilla",
  "Burning Crusade",
  "Lich King",
  "Cataclysm",
  "Pandaria",
  "Draenor",
  "Legion",
  "Azeroth",
  "Shadowlands",
  "Dragonflight",
  "War Within",
  "Midnight",
  "Last Titan",
];
const filters = [
  "Tüm bölümler",
  "Başlangıç",
  "Genişlemeler",
  "Worldsoul Saga",
  "Rehber & kaynaklar",
];
const QuietContext = createContext(false);

export function Brand({ onClick }) {
  return (
    <a
      className="brand"
      href="#"
      onClick={onClick}
      aria-label="Hikâye Atlası ana sayfa"
    >
      <span className="brand-seal" aria-hidden="true">
        W
      </span>
      <span>
        WARCRAFT<small>HİKÂYE ATLASI</small>
      </span>
    </a>
  );
}
function Reveal({ children, className = "", delay = 0 }) {
  const systemReduced = useReducedMotion();
  const reduced = useContext(QuietContext) || systemReduced;
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.65, delay }}
    >
      {children}
    </motion.div>
  );
}
function readSaved() {
  try {
    const n = Number(localStorage.getItem("wow-last-page"));
    return Number.isInteger(n) && n >= 1 && n <= catalog.slideCount ? n : 0;
  } catch {
    return 0;
  }
}
function hashPage() {
  const match = window.location.hash.match(/^#atlas\/(\d+)$/);
  return match
    ? Math.max(1, Math.min(catalog.slideCount, Number(match[1])))
    : null;
}

export default function App() {
  const systemReduced = useReducedMotion();
  const [quiet, setQuiet] = useState(false);
  const [menu, setMenu] = useState(false);
  const [eraIndex, setEraIndex] = useState(1);
  const [filter, setFilter] = useState(0);
  const [page, setPage] = useState(hashPage);
  const [query, setQuery] = useState("");
  const [focusSearch, setFocusSearch] = useState(false);
  const [saved, setSaved] = useState(readSaved);
  const [sticky, setSticky] = useState(false);
  const eraRefs = useRef([]);
  const reducedMotion = !!systemReduced || quiet;
  const selected = eras[eraIndex];
  const featured = catalog.slides
    .filter((s) => s.chapterId === selected.id && s.number > selected.start)
    .slice(0, 3);
  useEffect(() => {
    document.documentElement.classList.toggle("motion-paused", reducedMotion);
    return () => document.documentElement.classList.remove("motion-paused");
  }, [reducedMotion]);
  useEffect(() => {
    const hash = () => {
      const next = hashPage();
      setPage(next);
      setSaved(next || readSaved());
    };
    const scroll = () => setSticky(window.scrollY > 40);
    window.addEventListener("hashchange", hash);
    window.addEventListener("scroll", scroll, { passive: true });
    scroll();
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("scroll", scroll);
    };
  }, []);
  useEffect(() => {
    if (!page) {
      document.title = "Azeroth’un Hikâyesi · Warcraft Hikâye Atlası";
      return;
    }
    try {
      localStorage.setItem("wow-last-page", String(page));
    } catch {
      /* Storage is optional. */
    }
  }, [page]);
  useEffect(() => {
    const keydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuery("");
        setFocusSearch(true);
        setPage((p) => p || readSaved() || 1);
        if (!hashPage()) window.location.hash = `atlas/${readSaved() || 1}`;
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  function openReader(number = 5, search = "", focus = false) {
    setQuery(search);
    setFocusSearch(focus);
    setMenu(false);
    setPage(number);
    setSaved(number);
    window.location.hash = `atlas/${number}`;
  }
  function closeReader() {
    setPage(null);
    setQuery("");
    setFocusSearch(false);
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    document.title = "Azeroth’un Hikâyesi · Warcraft Hikâye Atlası";
  }
  function selectEra(index, focus = false) {
    const next = Math.max(0, Math.min(eras.length - 1, index));
    setEraIndex(next);
    eraRefs.current[next]?.scrollIntoView({
      behavior: reducedMotion ? "instant" : "smooth",
      block: "nearest",
      inline: "center",
    });
    if (focus) eraRefs.current[next]?.focus();
  }
  const visibleChapters = catalog.chapters.filter(
    (c) =>
      filter === 0 ||
      (filter === 1 && c.index <= 0) ||
      (filter === 2 && c.index >= 1 && c.index <= 10) ||
      (filter === 3 && c.index >= 11 && c.index <= 13) ||
      (filter === 4 && c.index >= 14),
  );
  return (
    <QuietContext.Provider value={reducedMotion}>
      <div className={reducedMotion ? "site reduced-motion" : "site"}>
        <a className="skip-link" href="#main">
          İçeriğe geç
        </a>
        <header className={`site-header ${sticky ? "scrolled" : ""}`}>
          <div className="header-inner">
            <Brand onClick={() => setMenu(false)} />
            <nav
              className={`main-nav ${menu ? "is-open" : ""}`}
              aria-label="Ana menü"
            >
              <a href="#kesfet" onClick={() => setMenu(false)}>
                Keşfet
              </a>
              <a href="#zaman-cizelgesi" onClick={() => setMenu(false)}>
                Zaman çizelgesi
              </a>
              <a href="#bolumler" onClick={() => setMenu(false)}>
                Bölümler
              </a>
              <button onClick={() => openReader(326)}>Kaynaklar</button>
            </nav>
            <div className="header-actions">
              <button
                className="search-button"
                onClick={() => openReader(saved || 1, "", true)}
                aria-label="Atlas içinde ara"
              >
                <Search size={17} />
                <span>Atlas’ta ara</span>
                <kbd>⌘ K</kbd>
              </button>
              <span className="language">TR</span>
              <button
                className="icon-button mobile-menu"
                aria-label={menu ? "Menüyü kapat" : "Menüyü aç"}
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
              >
                {menu ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </header>
        <main id="main">
          <section className="hero" id="kesfet" aria-labelledby="hero-title">
            <img
              className="hero-art"
              src="/art/azeroth-gateway.webp"
              alt=""
              fetchPriority="high"
            />
            <div className="hero-shade" />
            {!reducedMotion && (
              <Suspense fallback={null}>
                <ArcaneScene
                  reducedMotion={reducedMotion}
                  className="hero-cosmos"
                />
              </Suspense>
            )}
            <div className="hero-content shell">
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9 }}
              >
                <p className="eyebrow hero-eyebrow">
                  <span /> WORLD OF WARCRAFT · RETAIL
                </p>
                <h1 id="hero-title">
                  Azeroth’un
                  <br />
                  <em>hikâyesi.</em>
                </h1>
                <p className="hero-description">
                  İlk savaşların küllerinden Worldsoul Saga’ya.
                  <br className="desktop-break" /> Bir dünyayı değiştiren
                  çağlar, karakterler ve kaderler.
                </p>
                <div className="hero-ctas">
                  <button
                    className="button button-gold"
                    onClick={() => openReader(5)}
                  >
                    <BookOpen size={18} /> Yolculuğa başla{" "}
                    <ArrowUpRight size={18} />
                  </button>
                  <a className="hero-secondary" href="#zaman-cizelgesi">
                    Çağları keşfet <ArrowRight size={17} />
                  </a>
                </div>
                <p className="hero-credit">
                  İçerik, <strong>Gaddar - Huntart FTW</strong> tarafından
                  hazırlanmıştır.
                </p>
                {saved > 0 && (
                  <button
                    className="resume-link"
                    onClick={() => openReader(saved)}
                  >
                    Kaldığın yerden devam et <span>Sayfa {saved}</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </motion.div>
            </div>
            <div className="hero-bottom shell">
              <div className="hero-facts">
                <div>
                  <strong>327</strong>
                  <span>ANLATI SAYFASI</span>
                </div>
                <i />
                <div>
                  <strong>17</strong>
                  <span>BÖLÜM</span>
                </div>
                <i />
                <div>
                  <strong>1</strong>
                  <span>AZEROTH</span>
                </div>
              </div>
              <a className="scroll-cue" href="#zaman-cizelgesi">
                <span>HİKÂYE DEVAM EDİYOR</span>
                <ArrowDown size={17} />
              </a>
              <button
                className="motion-toggle"
                onClick={() => setQuiet(!quiet)}
                aria-label={reducedMotion ? "Efektleri aç" : "Efektleri durdur"}
                aria-pressed={reducedMotion}
                disabled={!!systemReduced}
                title={
                  systemReduced
                    ? "Sistem hareket azaltma tercihi etkin"
                    : "Görsel efektler"
                }
              >
                {reducedMotion ? <Play size={13} /> : <Pause size={13} />}
                <span>EFEKTLER</span>
              </button>
            </div>
          </section>
          <section
            className="chronicle section-space"
            id="zaman-cizelgesi"
            aria-labelledby="timeline-title"
          >
            <div className="shell">
              <Reveal className="section-heading">
                <div>
                  <p className="eyebrow">
                    <span className="tiny-diamond" /> ÇAĞLAR BOYUNCA
                  </p>
                  <h2 id="timeline-title">Tarihin izinde.</h2>
                </div>
                <p>
                  Her çağ yeni bir dünya açar.
                  <br />
                  Zaman çizelgesinden kendi yolunu seç.
                </p>
              </Reveal>
              <Reveal>
                <div className="timeline-wrap">
                  <div
                    className="timeline"
                    role="tablist"
                    aria-label="Hikâye dönemleri"
                  >
                    {eras.map((era, i) => (
                      <button
                        key={era.id}
                        ref={(el) => {
                          eraRefs.current[i] = el;
                        }}
                        id={`era-tab-${i}`}
                        role="tab"
                        aria-selected={i === eraIndex}
                        aria-controls="era-panel"
                        tabIndex={i === eraIndex ? 0 : -1}
                        className={`era-tab ${i === eraIndex ? "active" : ""}`}
                        onClick={() => selectEra(i)}
                        onKeyDown={(e) => {
                          if (
                            ["ArrowRight", "ArrowLeft", "Home", "End"].includes(
                              e.key,
                            )
                          ) {
                            e.preventDefault();
                            selectEra(
                              e.key === "Home"
                                ? 0
                                : e.key === "End"
                                  ? eras.length - 1
                                  : i + (e.key === "ArrowRight" ? 1 : -1),
                              true,
                            );
                          }
                        }}
                      >
                        <span className="era-year">
                          {i === 0 ? "BAŞLANGIÇ" : era.period.split("–")[0]}
                        </span>
                        <span className="era-dot" />
                        <span className="era-name">{shortNames[i]}</span>
                      </button>
                    ))}
                  </div>
                  <div className="timeline-arrows">
                    <button
                      className="icon-button"
                      onClick={() => selectEra(eraIndex - 1)}
                      disabled={eraIndex === 0}
                      aria-label="Önceki dönem"
                    >
                      <ArrowLeft size={17} />
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => selectEra(eraIndex + 1)}
                      disabled={eraIndex === eras.length - 1}
                      aria-label="Sonraki dönem"
                    >
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </div>
                <div
                  className="era-panel"
                  id="era-panel"
                  role="tabpanel"
                  aria-labelledby={`era-tab-${eraIndex}`}
                  style={{ "--era-color": colors[eraIndex] }}
                >
                  <div className="era-visual" aria-hidden="true">
                    <div className="era-emblem-ring" />
                    <div className="era-emblem-inner" />
                    <img
                      key={selected.coverImage}
                      src={selected.coverImage}
                      alt=""
                    />
                    <span className="era-visual-number">
                      {String(selected.index).padStart(2, "0")}
                    </span>
                    <span className="era-visual-label">
                      THE CHRONICLES OF AZEROTH
                    </span>
                  </div>
                  <motion.div
                    key={selected.id}
                    className="era-copy"
                    initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                  >
                    <div className="era-meta">
                      <span>
                        BÖLÜM {String(selected.index).padStart(2, "0")}
                      </span>
                      <span>{selected.period}</span>
                      {selected.index === 13 && (
                        <span className="future-label">DUYURULAN DÖNEM</span>
                      )}
                    </div>
                    <h3>{selected.title}</h3>
                    <p>{selected.subtitle}</p>
                    <div className="era-preview">
                      {featured.map((s) => (
                        <button
                          key={s.number}
                          onClick={() => openReader(s.number)}
                        >
                          <span>{s.title}</span>
                          <ArrowUpRight size={14} />
                        </button>
                      ))}
                    </div>
                    <button
                      className="text-link"
                      onClick={() => openReader(selected.start)}
                    >
                      Bu döneme adım at <ArrowRight size={17} />
                    </button>
                    <span className="era-page-count">
                      {selected.end - selected.start + 1} sayfa
                    </span>
                  </motion.div>
                </div>
              </Reveal>
            </div>
          </section>
          <section
            className="threads section-space"
            aria-labelledby="threads-title"
          >
            <div className="shell">
              <Reveal className="section-heading">
                <div>
                  <p className="eyebrow">
                    <span className="tiny-diamond" /> BİRBİRİNE BAĞLANAN
                    KADERLER
                  </p>
                  <h2 id="threads-title">Dört iplik. Tek hikâye.</h2>
                </div>
                <button className="text-link" onClick={() => openReader(4)}>
                  Büyük resmi gör <ArrowUpRight size={16} />
                </button>
              </Reveal>
              <div className="thread-grid">
                {catalog.threads.map((thread, i) => (
                  <Reveal key={thread.title} delay={i * 0.07}>
                    <button
                      className={`thread-card thread-${i}`}
                      onClick={() => openReader(4, thread.query, true)}
                    >
                      <span className="thread-top">
                        <img src={thread.image} alt="" loading="lazy" />
                        <span>0{i + 1}</span>
                      </span>
                      <span className="thread-label">{thread.label}</span>
                      <h3>{thread.title}</h3>
                      <p>{thread.body}</p>
                      <span className="thread-bottom">
                        Hikâyenin izini sür <ArrowUpRight size={17} />
                      </span>
                    </button>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
          <section
            className="archive section-space"
            id="bolumler"
            aria-labelledby="archive-title"
          >
            <div className="shell">
              <Reveal className="section-heading">
                <div>
                  <p className="eyebrow">
                    <span className="tiny-diamond" /> HİKÂYE KÜTÜPHANESİ
                  </p>
                  <h2 id="archive-title">Atlası aç.</h2>
                </div>
                <p>
                  Baştan sona bir yolculuk.
                  <br />
                  Ya da merak ettiğin tek bir hikâye.
                </p>
              </Reveal>
              <div className="archive-toolbar">
                <div
                  className="archive-filters"
                  role="group"
                  aria-label="Bölüm kategorisi"
                >
                  {filters.map((name, i) => (
                    <button
                      key={name}
                      className={filter === i ? "selected" : ""}
                      aria-pressed={filter === i}
                      onClick={() => setFilter(i)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <span className="result-count" aria-live="polite">
                  {visibleChapters.length} bölüm
                </span>
              </div>
              <div className="chapter-grid">
                {visibleChapters.map((chapter) => (
                  <button
                    className="chapter-card"
                    key={chapter.id}
                    onClick={() => openReader(chapter.start)}
                  >
                    <div className="chapter-card-top">
                      <span className="chapter-index">
                        {chapter.index >= 0
                          ? String(chapter.index).padStart(2, "0")
                          : "REHBER"}
                      </span>
                      <span>{chapter.period}</span>
                    </div>
                    <div className="chapter-card-main">
                      {chapter.coverImage ? (
                        <img src={chapter.coverImage} alt="" loading="lazy" />
                      ) : (
                        <BookOpen className="chapter-fallback" size={40} />
                      )}
                      <h3>{chapter.title}</h3>
                    </div>
                    <div className="chapter-card-bottom">
                      <span>
                        {chapter.end - chapter.start + 1} sayfa <i />{" "}
                        {chapter.start}–{chapter.end}
                      </span>
                      <ArrowUpRight size={17} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>
          <section className="closing">
            <div className="closing-art" />
            <div className="shell closing-content">
              <Reveal>
                <Compass size={32} strokeWidth={1} />
                <p className="eyebrow">BİR SONRAKİ SAYFA SENİ BEKLİYOR</p>
                <h2>
                  Her hikâye,
                  <br />
                  <em>bir yolculukla başlar.</em>
                </h2>
                <button
                  className="button button-gold"
                  onClick={() => openReader(saved || 1)}
                >
                  <BookOpen size={17} />
                  {saved ? "Okumaya devam et" : "Atlası okumaya başla"}
                  <ArrowRight size={17} />
                </button>
              </Reveal>
            </div>
          </section>
        </main>
        <footer className="site-footer shell">
          <div className="footer-top">
            <Brand />
            <p>
              Vanilla’dan The Last Titan’a.
              <br />
              Türkçe World of Warcraft hikâye atlası.
            </p>
            <button className="text-link" onClick={() => openReader(326)}>
              Kaynaklar & notlar <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="footer-bottom">
            <span>BAĞIMSIZ BİR HAYRAN PROJESİ</span>
            <p>
              Ekim 2026 tarihli kaynak sunuma dayanır. World of Warcraft ve
              ilgili adlar Blizzard Entertainment’a aittir.
            </p>
            <span className="footer-language">
              TÜRKÇE <Check size={12} />
            </span>
          </div>
        </footer>
        {page && (
          <Suspense
            fallback={
              <div className="reader-loading" role="status">
                <Sparkles size={24} />
                <span>Atlas açılıyor…</span>
                <button className="text-link" onClick={closeReader}>
                  Kapat <X size={16} />
                </button>
              </div>
            }
          >
            <AtlasReader
              page={page}
              onPage={(number) => {
                setPage(number);
                window.location.hash = `atlas/${number}`;
              }}
              onClose={closeReader}
              query={query}
              onQuery={setQuery}
              focusSearch={focusSearch}
            />
          </Suspense>
        )}
      </div>
    </QuietContext.Provider>
  );
}
