import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./QuestBoard.css";

const HH_API_URL = "https://api.hh.ru/vacancies";
const HH_HEADERS = {
    "HH-User-Agent": "CareerRPG/0.1 (alexsmi1992@gmail.com)",
};

const NOTE_SPRITES = ["images/note-1.png", "images/note-2.png", "images/note-3.png"];

// размеры листка внутри внутренней области доски (в процентах)
const CARD_W = 20; // ширина
const CARD_H = 30; // высота
const MAX_TRIES = 200;

function rectsOverlap(a, b) {
    return !(
        b.left >= a.left + a.width ||
        b.left + b.width <= a.left ||
        b.top >= a.top + a.height ||
        b.top + b.height <= a.top
    );
}

function generatePositions(count) {
    const positions = [];

    for (let i = 0; i < count; i += 1) {
        let top;
        let left;
        let tries = 0;
        let ok = false;

        while (!ok && tries < MAX_TRIES) {
            left = Math.random() * (100 - CARD_W);
            top = Math.random() * (100 - CARD_H);

            const candidate = { top, left, width: CARD_W, height: CARD_H };
            const collision = positions.some((p) => rectsOverlap(p, candidate));

            if (!collision) {
                ok = true;
                positions.push(candidate);
            } else {
                tries += 1;
            }
        }

        if (!ok) {
            positions.push({ top: 0, left: 0, width: CARD_W, height: CARD_H });
        }
    }

    return positions;
}

function makeDescriptionInfo(html) {
    if (!html) return { paragraphs: [], baseFontSize: 18 };

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const fullText = (doc.body.textContent || "").replace(/\s+/g, " ").trim();

    const length = fullText.length;
    let baseFontSize;
    let limit;

    if (length <= 350) {
        baseFontSize = 20;
        limit = 350;
    } else if (length <= 800) {
        baseFontSize = 18;
        limit = 800;
    } else {
        baseFontSize = 16;
        limit = 900;
    }

    let text = fullText.slice(0, limit);
    if (fullText.length > limit) text += "…";

    const sentences = text.split(/(?<=[.!?])\s+/);
    const paragraphs = [];
    let current = "";

    sentences.forEach((s) => {
        if (!s) return;
        if ((current + " " + s).length > 280) {
            if (current) paragraphs.push(current.trim());
            current = s;
        } else {
            current = current ? `${current} ${s}` : s;
        }
    });

    if (current) paragraphs.push(current.trim());

    return { paragraphs, baseFontSize };
}

function QuestNoteModal({ vacancy, onClose, spriteIndex }) {
    if (!vacancy) return null;

    const spriteSrc = NOTE_SPRITES[spriteIndex % NOTE_SPRITES.length];

    const contentRef = useRef(null);
    const [fontSize, setFontSize] = useState(null);

    const { paragraphs, baseFontSize } = useMemo(
        () => makeDescriptionInfo(vacancy.description),
        [vacancy.description]
    );

    const descriptionKey = paragraphs.join(" ");

    useLayoutEffect(() => {
        const el = contentRef.current;
        if (!el) return;

        let size = baseFontSize;
        const minSize = 10;

        el.style.fontSize = `${size}px`;
        el.style.lineHeight = "1.3";

        while (
            (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) &&
            size > minSize
        ) {
            size -= 1;
            el.style.fontSize = `${size}px`;
        }

        setFontSize(size);
    }, [descriptionKey, baseFontSize]);

    return (
        <div className="quest-modal-backdrop" onClick={onClose}>
            <div className="quest-modal">
                <img src={spriteSrc} alt="" className="quest-modal-bg" />

                <div
                    className="quest-modal-content"
                    ref={contentRef}
                    style={{ fontSize: fontSize || baseFontSize }}
                >
                    <h2 className="quest-modal-title">{vacancy.name}</h2>

                    {vacancy.employer?.name && (
                        <p className="quest-modal-meta">Компания: {vacancy.employer.name}</p>
                    )}
                    {vacancy.area?.name && (
                        <p className="quest-modal-meta">Город: {vacancy.area.name}</p>
                    )}
                    {vacancy.experience?.name && (
                        <p className="quest-modal-meta">Опыт: {vacancy.experience.name}</p>
                    )}
                    {vacancy.salary && (
                        <p className="quest-modal-meta">
                            Зарплата:{" "}
                            {vacancy.salary.from && `от ${vacancy.salary.from} `}
                            {vacancy.salary.to && `до ${vacancy.salary.to} `}
                            {vacancy.salary.currency}
                        </p>
                    )}
                    {vacancy.employment?.name && (
                        <p className="quest-modal-meta">
                            Занятость: {vacancy.employment.name}
                            {vacancy.schedule?.name && ` (${vacancy.schedule.name})`}
                        </p>
                    )}

                    {paragraphs.length > 0 && (
                        <div className="quest-modal-description">
                            {paragraphs.map((p, i) => (
                                <p key={i}>{p}</p>
                            ))}
                        </div>
                    )}

                    <a className="quest-modal-link" href={vacancy.alternate_url} target="_blank" rel="noreferrer">
                        Открыть вакансию
                    </a>

                </div>
            </div>
        </div>
    );
}

function QuestBoard() {
    const [vacancies, setVacancies] = useState([]);
    const [positions, setPositions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [selectedId, setSelectedId] = useState(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [details, setDetails] = useState({});
    const [detailsLoading, setDetailsLoading] = useState(false);

    const [searchText, setSearchText] = useState("веб-разработчик");

    async function fetchVacancies(query) {
        const text = query.trim() || "веб-разработчик";

        setLoading(true);
        setError(null);
        setSelectedId(null);

        const params = new URLSearchParams();
        params.set("text", text);
        params.append("experience", "noExperience");
        params.set("period", "7");
        params.set("per_page", "6");
        params.set("area", "1");

        const url = `${HH_API_URL}?${params.toString()}`;

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: HH_HEADERS,
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json();
            const items = (data.items || []).slice(0, 6);
            setVacancies(items);
            setPositions(generatePositions(items.length));
        } catch (err) {
            console.error(err);
            setError(err.message);
            // НЕ очищаем вакансии и позиции, чтобы доска не исчезала на ошибке
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchVacancies(searchText);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function handleSearchClick() {
        if (!searchText.trim()) return;
        fetchVacancies(searchText);
    }

    async function handleSelect(vacancy, index) {
        setSelectedId(vacancy.id);
        setSelectedIndex(index);

        if (details[vacancy.id]) return;

        setDetailsLoading(true);
        try {
            const resp = await fetch(`${HH_API_URL}/${vacancy.id}`, {
                method: "GET",
                headers: HH_HEADERS,
            });
            if (!resp.ok) throw new Error(`HTTP error: ${resp.status}`);
            const data = await resp.json();
            setDetails((prev) => ({ ...prev, [vacancy.id]: data }));
        } catch (e) {
            console.error(e);
        } finally {
            setDetailsLoading(false);
        }
    }

    function handleCloseModal() {
        setSelectedId(null);
    }

    return (
        <div className="quest-board-screen">
            <div className="quest-search-bar">
                <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Например: дизайнер"
                />
                <button type="button" onClick={handleSearchClick}>
                    НАЙТИ
                </button>
            </div>

            <div className="quest-board">
                <div className="quest-board-inner">
                    {vacancies.map((v, index) => {
                        const pos = positions[index];
                        if (!pos) return null;

                        const spriteSrc = NOTE_SPRITES[index % NOTE_SPRITES.length];

                        return (
                            <button
                                key={v.id}
                                type="button"
                                className="quest-note quest-note--small"
                                onClick={() => handleSelect(v, index)}
                                style={{
                                    top: `${pos.top}%`,
                                    left: `${pos.left}%`,
                                    width: `${CARD_W}%`,
                                    height: `${CARD_H}%`,
                                    "--note-rotation": `${(index % 2 === 0 ? 1 : -1) * (2 + (index % 3))
                                        }deg`,
                                }}
                            >
                                <img
                                    src={spriteSrc}
                                    alt=""
                                    className="quest-note-bg"
                                    aria-hidden="true"
                                />
                                <div className="quest-note-content">
                                    <div className="quest-title">{v.name}</div>
                                    <div className="quest-company">{v.employer?.name}</div>
                                    <div className="quest-city">{v.area?.name}</div>
                                    <div className="quest-exp">{v.experience?.name}</div>
                                    <div className="quest-link">Нажми, чтобы открыть квест</div>
                                </div>
                            </button>
                        );
                    })}
                </div>

            </div>
            {loading && (
                <div className="quest-board-overlay">
                    Обновляю квесты…
                </div>
            )}

            {error && (
                <p className="quest-status quest-status--error">
                    Ошибка загрузки: {error}
                </p>
            )}

            {!loading && !error && !vacancies.length && (
                <p className="quest-status">Квесты не найдены.</p>
            )}

            {selectedId && details[selectedId] && !detailsLoading && (
                <QuestNoteModal
                    vacancy={details[selectedId]}
                    spriteIndex={selectedIndex}
                    onClose={handleCloseModal}
                />
            )}

            {selectedId && detailsLoading && (
                <div className="quest-modal-backdrop">
                    <div className="quest-modal-loading">Загружаю описание…</div>
                </div>
            )}
        </div>
    );
}

export default QuestBoard;
