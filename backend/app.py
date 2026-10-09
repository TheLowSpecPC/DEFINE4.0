import os
from pathlib import Path
from urllib.parse import quote_plus

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

# Load environment variables from backend/.env
load_dotenv(Path(__file__).with_name(".env"))

app = Flask(__name__)
CORS(app)

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

# Keep the initial video batch small so users can load more when needed.
INITIAL_VIDEO_COUNT = 6
MORE_VIDEO_COUNT = 6


def make_video_resource(item):
    """Convert a YouTube API search item into the resource format used by UNIFY."""
    video_id = item.get("id", {}).get("videoId")
    snippet = item.get("snippet", {})

    if not video_id:
        return None

    thumbnails = snippet.get("thumbnails", {})
    thumbnail = thumbnails.get("medium") or thumbnails.get("default") or {}

    return {
        # Use the same stable ID format for initial and subsequent batches.
        "id": f"video-{video_id}",
        "category": "videos",
        "title": snippet.get("title", "Untitled video"),
        "description": snippet.get("description", ""),
        "source": snippet.get("channelTitle", "YouTube"),
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "thumbnail": thumbnail.get("url", ""),
    }


def search_github(topic, max_results=6):
    """Search public GitHub repositories and convert them to UNIFY resources."""
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    response = requests.get(
        "https://api.github.com/search/repositories",
        headers=headers,
        params={"q": topic, "sort": "stars", "order": "desc", "per_page": max_results},
        timeout=15,
    )
    response.raise_for_status()
    data = response.json()

    repositories = []
    for item in data.get("items", []):
        repositories.append({
            "id": f"github-{item.get('id')}",
            "category": "github",
            "title": item.get("full_name") or item.get("name", "GitHub repository"),
            "description": item.get("description") or "No description provided.",
            "source": item.get("language") or item.get("owner", {}).get("login", "GitHub"),
            "url": item.get("html_url", "https://github.com"),
            "stars": item.get("stargazers_count", 0),
        })
    return repositories


def search_youtube(topic, page_token=None, max_results=INITIAL_VIDEO_COUNT):
    """Search YouTube and return videos plus the next-page token, if any."""
    params = {
        "part": "snippet",
        "q": topic,
        "type": "video",
        "maxResults": max_results,
        "order": "relevance",
        "key": YOUTUBE_API_KEY,
    }

    if page_token:
        params["pageToken"] = page_token

    response = requests.get(
        "https://www.googleapis.com/youtube/v3/search",
        params=params,
        timeout=15,
    )
    response.raise_for_status()
    data = response.json()

    videos = []
    for item in data.get("items", []):
        video = make_video_resource(item)
        if video:
            videos.append(video)

    return videos, data.get("nextPageToken")


@app.route("/")
def home():
    return jsonify({"message": "UNIFY API is running!"})


@app.route("/api/resources")
def get_resources():
    topic = request.args.get("topic", "").strip()

    if not topic:
        return jsonify({"error": "Please enter a topic."}), 400

    query = quote_plus(topic)

    # These are external resource links, not AI-generated answers.
    resources = [
        {
            "id": "books",
            "category": "books",
            "title": f"Books about {topic}",
            "description": f"Explore books and textbooks about {topic}.",
            "source": "Google Books",
            "url": f"https://www.google.com/search?tbm=bks&q={query}",
        },
        {
            "id": "pyqs",
            "category": "pyqs",
            "title": f"{topic} previous-year questions",
            "description": f"Find exam questions and GATE practice papers for {topic}.",
            "source": "Web search",
            "url": (
                "https://www.google.com/search?q="
                + quote_plus(f"{topic} GATE previous year questions")
            ),
        },
    ]

    # Fetch real public repositories from GitHub. If the API fails, keep the
    # rest of UNIFY working and provide a normal GitHub search link as fallback.
    warnings = []
    try:
        github_resources = search_github(topic)
        resources = github_resources + resources
        if not github_resources:
            warnings.append("GitHub did not return any matching repositories.")
    except requests.RequestException:
        app.logger.exception("GitHub repository search failed")
        resources.insert(0, {
            "id": "github-search",
            "category": "github",
            "title": f"Search GitHub for {topic}",
            "description": "Open GitHub to browse matching public repositories.",
            "source": "GitHub",
            "url": f"https://github.com/search?q={query}&type=repositories",
        })
        warnings.append("GitHub API search failed; showing a direct search link instead.")

    # If YouTube is not configured, still return the other resource types.
    if not YOUTUBE_API_KEY:
        result = {
            "topic": topic,
            "count": len(resources),
            "resources": resources,
            "nextPageToken": None,
            "warning": "YouTube API key is not configured.",
        }
        if warnings:
            result["warnings"] = warnings
        return jsonify(result)

    try:
        videos, next_page_token = search_youtube(
            topic,
            max_results=INITIAL_VIDEO_COUNT,
        )

        resources = videos + resources

        result = {
            "topic": topic,
            "count": len(resources),
            "resources": resources,
            "nextPageToken": next_page_token,
        }
        if warnings:
            result["warnings"] = warnings
        return jsonify(result)

    except requests.RequestException:
        app.logger.exception("YouTube API request failed")
        return jsonify({
            "error": "YouTube search failed. Check your API key, quota, and connection."
        }), 502


@app.route("/api/videos")
def get_more_videos():
    topic = request.args.get("topic", "").strip()
    page_token = request.args.get("pageToken", "").strip()

    if not topic:
        return jsonify({"error": "Please enter a topic."}), 400

    if not YOUTUBE_API_KEY:
        return jsonify({"error": "YouTube API key is not configured."}), 400

    if not page_token:
        return jsonify({"error": "A pageToken is required to load more videos."}), 400

    try:
        videos, next_page_token = search_youtube(
            topic,
            page_token=page_token,
            max_results=MORE_VIDEO_COUNT,
        )

        return jsonify({
            "resources": videos,
            "nextPageToken": next_page_token,
        })

    except requests.RequestException:
        app.logger.exception("Loading more YouTube videos failed")
        return jsonify({
            "error": "Could not load more videos. Please try again."
        }), 502


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)