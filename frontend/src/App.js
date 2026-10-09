import { useState } from "react";
import "./App.css";

const categories = [
  { id: "all", label: "All resources" },
  { id: "videos", label: "YouTube" },
  { id: "books", label: "Books" },
  { id: "github", label: "GitHub" },
  { id: "pyqs", label: "PYQs" },
];

const icons = {
  videos: "▶",
  books: "▤",
  github: "⌘",
  pyqs: "▧",
};

function App() {
  const API_BASE = `http://${window.location.hostname}:5000`;
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [resources, setResources] = useState([]);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  async function handleSearch(event) {
    event.preventDefault();

    const searchTopic = query.trim();
    if (!searchTopic) {
      setError("Enter a topic to get started.");
      return;
    }

    setLoading(true);
    setError("");
    setNextPageToken(null);
    setTopic(searchTopic);
    setResources([]);
    setCategory("all");

    try {
      const response = await fetch(
        `${API_BASE}/api/resources?topic=${encodeURIComponent(searchTopic)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to search right now.");
      }

      setResources(data.resources);
      setNextPageToken(data.nextPageToken || null);
    } catch {
      setError(
        "Could not connect to UNIFY. Make sure the Flask backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  const loadMoreVideos = async () => {
    if (!nextPageToken || loadingMore) return;

    setLoadingMore(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/videos?topic=${encodeURIComponent(topic)}&pageToken=${encodeURIComponent(nextPageToken)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load more videos.");
      }

      setResources((current) => [
        ...current,
        ...(data.resources || []),
      ]);

      setNextPageToken(data.nextPageToken || null);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const visibleResources = resources.filter(
    (resource) =>
      category === "all" || resource.category === category
  );

  return (
    <div className="app">
      <header className="navbar">
        <a className="brand" href="#" aria-label="UNIFY home">
          <span className="brand-icon">u.</span>
          <span>unify<span className="brand-dot">.</span></span>
        </a>

        <span className="nav-caption">YOUR LEARNING, CONNECTED</span>
      </header>

      <main>
        <section className="hero">
          <div className="eyebrow">
            <span className="status-dot" />
            ONE TOPIC. MANY RESOURCES.
          </div>

          <h1>
            Everything you need
            <br />
            to <span className="highlight">learn better.</span>
          </h1>

          <p className="hero-description">
            One search brings together videos, books, open-source
            projects and exam questions from across the web.
          </p>

          <form className="search-form" onSubmit={handleSearch}>
            <span className="search-icon">⌕</span>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="What do you want to learn? Try TCP..."
              aria-label="Enter a learning topic"
            />
            <button type="submit" disabled={loading}>
              {loading ? "Searching..." : "Search"}
              {!loading && <span> ↗</span>}
            </button>
          </form>

          <div className="popular">
            <span>TRY SEARCHING</span>
            {["TCP", "Operating Systems", "Machine Learning"].map(
              (suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setQuery(suggestion)}
                  className="suggestion"
                >
                  {suggestion}
                </button>
              )
            )}
          </div>
        </section>

        {error && <div className="message error">{error}</div>}

        {!topic && !loading && (
          <section className="welcome">
            <div className="welcome-symbol">✳</div>
            <h2>Your next discovery starts here.</h2>
            <p>
              Search any subject to find resources from platforms
              you already know and trust.
            </p>

            <div className="category-preview">
              {categories.slice(1).map((item) => (
                <div className="preview-item" key={item.id}>
                  <span>{icons[item.id]}</span>
                  {item.label}
                </div>
              ))}
            </div>
          </section>
        )}

        {loading && (
          <div className="message loading">
            Finding resources for your topic...
          </div>
        )}

        {topic && !loading && resources.length > 0 && (
          <section className="results">
            <div className="results-heading">
              <div>
                <span className="section-label">YOUR SEARCH RESULTS</span>
                <h2>
                  Explore <span>{topic}</span>
                </h2>
                <p>Choose a resource and continue learning at its source.</p>
              </div>
              <span className="result-count">
                {resources.length} categories
              </span>
            </div>

            <div className="filters">
              {categories.map((item) => (
                <button
                  key={item.id}
                  className={`filter ${category === item.id ? "active" : ""}`}
                  onClick={() => setCategory(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* VIDEO SECTION: shown in All and Videos filters */}
              {(category === "all" || category === "videos") && (
                <section className="video-section">
                  <h3 className="resource-section-title">YouTube Videos</h3>

                  <div className="resource-grid">
                    {visibleResources
                      .filter((resource) => resource.category === "videos")
                      .map((resource) => (
                        <article className="resource-card" key={resource.id}>
                          {resource.thumbnail && (
                            <img
                              className="video-thumbnail"
                              src={resource.thumbnail}
                              alt={`Thumbnail for ${resource.title}`}
                              loading="lazy"
                            />
                          )}

                          <div className="card-top">
                            <div className="source-icon videos">
                              {icons.videos}
                            </div>
                            <span className="source-name">{resource.source}</span>
                            <span className="external-icon">↗</span>
                          </div>

                          <h3>{resource.title}</h3>
                          <p>{resource.description}</p>

                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="resource-link"
                          >
                            Watch video <span>→</span>
                          </a>
                        </article>
                      ))}
                  </div>

                  {nextPageToken && (
                    <div className="load-more-container">
                      <button
                        className="load-more-button"
                        onClick={loadMoreVideos}
                        disabled={loadingMore}
                        type="button"
                      >
                        {loadingMore ? "Loading videos..." : "Show more videos ↓"}
                      </button>
                    </div>
                  )}

                  {!nextPageToken &&
                    resources.some((r) => r.category === "videos") && (
                      <p className="results-note">
                        You've reached the end of the available videos.
                      </p>
                    )}
                </section>
              )}

              {/* ALL FILTER: show books, GitHub and PYQs below videos */}
              {category === "all" && (
                <section className="other-resources">
                  <h3 className="resource-section-title">More learning resources</h3>

                  <div className="resource-grid">
                    {visibleResources
                      .filter((resource) => resource.category !== "videos")
                      .map((resource) => (
                        <article className="resource-card" key={resource.id}>
                          <div className="card-top">
                            <div className={`source-icon ${resource.category}`}>
                              {icons[resource.category]}
                            </div>
                            <span className="source-name">{resource.source}</span>
                            <span className="external-icon">↗</span>
                          </div>

                          <h3>{resource.title}</h3>
                          <p>{resource.description}</p>

                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="resource-link"
                          >
                            Explore resources <span>→</span>
                          </a>
                        </article>
                      ))}
                  </div>
                </section>
              )}

              {/* INDIVIDUAL BOOKS, GITHUB OR PYQ FILTERS */}
              {category !== "all" && category !== "videos" && (
                <div className="resource-grid">
                  {visibleResources.map((resource) => (
                    <article className="resource-card" key={resource.id}>
                      <div className="card-top">
                        <div className={`source-icon ${resource.category}`}>
                          {icons[resource.category]}
                        </div>
                        <span className="source-name">{resource.source}</span>
                        <span className="external-icon">↗</span>
                      </div>

                      <h3>{resource.title}</h3>
                      <p>{resource.description}</p>

                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="resource-link"
                      >
                        Explore resources <span>→</span>
                      </a>
                    </article>
                  ))}
                </div>
              )}

            {visibleResources.length === 0 && (
              <div className="message">
                No resources in this category.
              </div>
            )}

            <p className="results-note">
              UNIFY connects you to external resources. Results open
              on their original websites.
            </p>
          </section>
        )}
      </main>

      <footer>
        <a className="footer-brand" href="#">unify.</a>
        <span>Discover more. Learn your way.</span>
        <span>Made for curious minds <span className="footer-heart">♥</span></span>
      </footer>
    </div>
  );
}

export default App;