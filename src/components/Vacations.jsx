import { useEffect, useState } from "react";

const HH_API_URL = "https://api.hh.ru/vacancies";
const HH_HEADERS = {
    "HH-User-Agent": "CareerRPG/0.1 (alexsmi1992@gmail.com)",
};

function WebDevVacancies() {
    const [vacancies, setVacancies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // id вакансии, для которой грузим детали
    const [expandedId, setExpandedId] = useState(null);
    const [details, setDetails] = useState({}); // { [id]: vacancyFull | undefined }
    const [detailsLoading, setDetailsLoading] = useState(null); // id, которая сейчас грузится

    useEffect(() => {
        const controller = new AbortController();

        async function loadVacancies() {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            params.set("text", "веб-разработчик");
            params.append("experience", "noExperience");
            // params.append("experience", "between1And3");
            params.set("period", "7");
            params.set("per_page", "7");

            params.set('area', '1');

            const url = `${HH_API_URL}?${params.toString()}`;

            try {
                const response = await fetch(url, {
                    method: "GET",
                    headers: HH_HEADERS,
                    signal: controller.signal,
                });

                if (!response.ok) {
                    const text = await response.text();
                    console.error("Search error body:", text);
                    throw new Error(`HTTP error: ${response.status}`);
                }

                const data = await response.json();
                setVacancies(data.items || []);
            } catch (err) {
                if (err.name !== "AbortError") {
                    console.error(err);
                    setError(err.message);
                }
            } finally {
                setLoading(false);
            }
        }

        loadVacancies();
        return () => controller.abort();
    }, []);

    async function loadDetails(id) {
        // если уже загружали — просто раскрываем
        if (details[id]) {
            setExpandedId(expandedId === id ? null : id);
            return;
        }

        setDetailsLoading(id);
        setExpandedId(id);

        try {
            const response = await fetch(`${HH_API_URL}/${id}`, {
                method: "GET",
                headers: HH_HEADERS,
            });

            if (!response.ok) {
                const text = await response.text();
                console.error("Details error body:", text);
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json();
            setDetails((prev) => ({ ...prev, [id]: data }));
        } catch (err) {
            console.error(err);
            // по-хорошему: показать сообщение об ошибке возле этой вакансии
        } finally {
            setDetailsLoading(null);
        }
    }

    if (loading) return <p>Загружаю вакансии…</p>;
    if (error) return <p>Ошибка загрузки: {error}</p>;
    if (!vacancies.length) return <p>Вакансий по критериям не найдено.</p>;

    return (
        <div>
            <h2>Вакансии веб-разработчика (0–3 года опыта)</h2>
            <ul>
                {vacancies.map((vacancy) => {
                    const isExpanded = expandedId === vacancy.id;
                    const full = details[vacancy.id];

                    return (
                        <li key={vacancy.id} style={{ marginBottom: "1.5rem" }}>
                            <strong>{vacancy.name}</strong>
                            <div>Компания: {vacancy.employer?.name}</div>
                            <div>Город: {vacancy.area?.name}</div>
                            <div>Опыт: {vacancy.experience?.name}</div>
                            <a href={vacancy.alternate_url} target="_blank" rel="noreferrer">
                                Открыть на hh.ru
                            </a>

                            <div>
                                <button
                                    type="button"
                                    onClick={() => loadDetails(vacancy.id)}
                                    disabled={detailsLoading === vacancy.id}
                                    style={{ marginTop: "0.5rem" }}
                                >
                                    {detailsLoading === vacancy.id
                                        ? "Загружаю…"
                                        : isExpanded
                                            ? "Скрыть детали"
                                            : "Показать детали"}
                                </button>
                            </div>

                            {isExpanded && full && (
                                <div style={{ marginTop: "0.5rem" }}>
                                    {full.salary && (
                                        <div>
                                            Зарплата:{" "}
                                            {full.salary.from && `от ${full.salary.from} `}
                                            {full.salary.to && `до ${full.salary.to} `}
                                            {full.salary.currency}
                                        </div>
                                    )}

                                    <div>
                                        Тип занятости: {full.employment?.name}{" "}
                                        {full.schedule && `(${full.schedule.name})`}
                                    </div>

                                    {/* описание приходит как HTML */}
                                    {full.description && (
                                        <div
                                            style={{ marginTop: "0.5rem" }}
                                            dangerouslySetInnerHTML={{
                                                __html: full.description,
                                            }}
                                        />
                                    )}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default WebDevVacancies;
