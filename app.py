#!/usr/bin/env python3
"""
CineMetrics - Flask Web Application & Cinematic Analytics API
Serves interactive dashboard frontend and provides REST endpoints for
movie filtering, statistical correlations, and data exports.
"""

import os
import json
import math
import csv
from io import StringIO
from collections import defaultdict
from flask import Flask, render_template, jsonify, request, send_file, Response

app = Flask(__name__)

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "data", "movies.json")

def load_movies():
    """Load movies from JSON file with calculated financial fields."""
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        movies = json.load(f)
    for m in movies:
        if "profit" not in m:
            m["profit"] = m["revenue"] - m["budget"]
        if "roi" not in m:
            m["roi"] = round(((m["revenue"] - m["budget"]) / m["budget"]) * 100, 2) if m.get("budget", 0) > 0 else 0
    return movies

# In-memory working dataset (resettable)
CURRENT_MOVIES = load_movies()

def calculate_correlations(movies):
    """Calculates Pearson correlation coefficients."""
    if len(movies) < 2:
        return {"budget_vs_revenue": 0, "rating_vs_revenue": 0, "budget_vs_roi": 0, "rating_vs_metascore": 0}
    
    def pearson(x, y):
        n = len(x)
        mean_x = sum(x) / n
        mean_y = sum(y) / n
        num = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
        den_x = math.sqrt(sum((x[i] - mean_x) ** 2 for i in range(n)))
        den_y = math.sqrt(sum((y[i] - mean_y) ** 2 for i in range(n)))
        return round(num / (den_x * den_y), 4) if den_x != 0 and den_y != 0 else 0

    budgets = [m["budget"] for m in movies]
    revenues = [m["revenue"] for m in movies]
    ratings = [m["rating"] for m in movies]
    rois = [m["roi"] for m in movies]
    
    rated_metas = [(m["rating"], m["metascore"]) for m in movies if m.get("metascore")]
    corr_meta = pearson([p[0] for p in rated_metas], [p[1] for p in rated_metas]) if len(rated_metas) > 1 else 0

    return {
        "budget_vs_revenue": pearson(budgets, revenues),
        "rating_vs_revenue": pearson(ratings, revenues),
        "budget_vs_roi": pearson(budgets, rois),
        "rating_vs_metascore": corr_meta
    }

# ---------------------------------------------------------
# Web Routes
# ---------------------------------------------------------

@app.route("/")
def index():
    """Render the main dashboard interface."""
    return render_template("index.html")

# ---------------------------------------------------------
# REST API Endpoints
# ---------------------------------------------------------

@app.route("/api/movies", methods=["GET"])
def get_movies():
    """
    Returns filtered and sorted movie records.
    Query params supported:
    - search: title, director, cast, or genre substring
    - genre: specific genre or 'all'
    - decade: e.g. '2010s', '1990s', or 'all'
    - budget_tier: 'low' (<₹25M), 'mid' (₹25M-₹100M), 'high' (>₹100M), or 'all'
    - min_rating: float (e.g. 7.5)
    - sort: 'revenue-desc', 'revenue-asc', 'roi-desc', 'rating-desc', 'year-desc', etc.
    """
    search = request.args.get("search", "").strip().lower()
    genre = request.args.get("genre", "all")
    decade = request.args.get("decade", "all")
    budget_tier = request.args.get("budget_tier", "all")
    min_rating = float(request.args.get("min_rating", 0))
    sort_by = request.args.get("sort", "revenue-desc")

    filtered = []
    for m in CURRENT_MOVIES:
        # Search match
        if search:
            match_title = search in m["title"].lower()
            match_dir = search in m["director"].lower()
            match_cast = any(search in c.lower() for c in m.get("cast", []))
            match_genre = any(search in g.lower() for g in m.get("genres", []))
            if not (match_title or match_dir or match_cast or match_genre):
                continue

        # Genre
        if genre != "all" and genre not in m.get("genres", []):
            continue

        # Decade
        if decade != "all":
            try:
                dec_start = int(decade.replace("s", ""))
                if m["year"] < dec_start or m["year"] > dec_start + 9:
                    continue
            except ValueError:
                pass

        # Budget Tier
        if budget_tier == "low" and m["budget"] >= 25_000_000:
            continue
        elif budget_tier == "mid" and (m["budget"] < 25_000_000 or m["budget"] > 100_000_000):
            continue
        elif budget_tier == "high" and m["budget"] <= 100_000_000:
            continue

        # Rating
        if m["rating"] < min_rating:
            continue

        filtered.append(m)

    # Sorting
    if sort_by == "revenue-desc":
        filtered.sort(key=lambda x: x["revenue"], reverse=True)
    elif sort_by == "revenue-asc":
        filtered.sort(key=lambda x: x["revenue"])
    elif sort_by == "roi-desc":
        filtered.sort(key=lambda x: x["roi"], reverse=True)
    elif sort_by == "rating-desc":
        filtered.sort(key=lambda x: x["rating"], reverse=True)
    elif sort_by == "budget-desc":
        filtered.sort(key=lambda x: x["budget"], reverse=True)
    elif sort_by == "year-desc":
        filtered.sort(key=lambda x: x["year"], reverse=True)
    elif sort_by == "title-asc":
        filtered.sort(key=lambda x: x["title"])

    return jsonify({
        "success": True,
        "count": len(filtered),
        "total_in_db": len(CURRENT_MOVIES),
        "movies": filtered
    })

@app.route("/api/movie/<int:movie_id>", methods=["GET"])
def get_movie_detail(movie_id):
    """Retrieve details for a single movie by ID."""
    for m in CURRENT_MOVIES:
        if m["id"] == movie_id:
            return jsonify({"success": True, "movie": m})
    return jsonify({"success": False, "error": "Movie not found"}), 404

@app.route("/api/insights", methods=["GET"])
def get_insights():
    """Computes real-time econometric and statistical analysis across the current dataset."""
    movies = CURRENT_MOVIES
    if not movies:
        return jsonify({"success": False, "error": "No data available"}), 400

    total_gross = sum(m["revenue"] for m in movies)
    total_budget = sum(m["budget"] for m in movies)
    total_profit = total_gross - total_budget
    market_roi = round((total_profit / total_budget) * 100, 2) if total_budget > 0 else 0
    avg_rating = round(sum(m["rating"] for m in movies) / len(movies), 2)
    correlations = calculate_correlations(movies)

    # Genre analytics
    genre_map = defaultdict(lambda: {"count": 0, "revenue": 0, "budget": 0, "rois": []})
    for m in movies:
        for g in m.get("genres", []):
            genre_map[g]["count"] += 1
            genre_map[g]["revenue"] += m["revenue"]
            genre_map[g]["budget"] += m["budget"]
            genre_map[g]["rois"].append(m["roi"])

    genres_summary = []
    for g, data in genre_map.items():
        genres_summary.append({
            "genre": g,
            "count": data["count"],
            "total_revenue": data["revenue"],
            "avg_roi": round(sum(data["rois"]) / len(data["rois"]), 2)
        })
    genres_summary.sort(key=lambda x: x["total_revenue"], reverse=True)

    # Director power rankings
    dir_map = defaultdict(lambda: {"count": 0, "revenue": 0, "ratings": [], "movies": []})
    for m in movies:
        dir_map[m["director"]]["count"] += 1
        dir_map[m["director"]]["revenue"] += m["revenue"]
        dir_map[m["director"]]["ratings"].append(m["rating"])
        dir_map[m["director"]]["movies"].append(m["title"])

    director_rankings = []
    for d, data in dir_map.items():
        director_rankings.append({
            "director": d,
            "film_count": data["count"],
            "total_revenue": data["revenue"],
            "avg_rating": round(sum(data["ratings"]) / len(data["ratings"]), 2),
            "top_movies": data["movies"][:3]
        })
    director_rankings.sort(key=lambda x: x["total_revenue"], reverse=True)

    return jsonify({
        "success": True,
        "kpis": {
            "total_films": len(movies),
            "total_gross": total_gross,
            "total_budget": total_budget,
            "total_profit": total_profit,
            "market_roi": market_roi,
            "avg_rating": avg_rating
        },
        "correlations": correlations,
        "top_genres": genres_summary[:8],
        "top_directors": director_rankings[:8],
        "highest_grossing": sorted(movies, key=lambda x: x["revenue"], reverse=True)[:5],
        "highest_roi": sorted(movies, key=lambda x: x["roi"], reverse=True)[:5]
    })

@app.route("/api/upload", methods=["POST"])
def upload_csv():
    """Upload and parse custom CSV dataset."""
    global CURRENT_MOVIES
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file uploaded"}), 400
    file = request.files["file"]
    if not file.filename.endswith(".csv"):
        return jsonify({"success": False, "error": "File must be a .csv"}), 400

    try:
        content = file.stream.read().decode("utf-8")
        reader = csv.DictReader(StringIO(content))
        new_movies = []
        idx = 1
        for row in reader:
            clean = {k.strip().lower(): v.strip() for k, v in row.items() if k}
            title = clean.get("title") or clean.get("name") or f"Movie #{idx}"
            year = int(clean.get("year", 2020))
            genre_str = clean.get("genres") or clean.get("genre") or "Drama"
            genres = [g.strip() for g in genre_str.replace(";", ",").replace("|", ",").split(",") if g.strip()]
            director = clean.get("director", "Unknown")
            rating = float(clean.get("rating", 7.0))
            budget = float(clean.get("budget", 20000000))
            revenue = float(clean.get("revenue") or clean.get("gross", 60000000))
            profit = revenue - budget
            roi = round(((revenue - budget) / budget) * 100, 2) if budget > 0 else 0

            new_movies.append({
                "id": 2000 + idx,
                "title": title,
                "year": year,
                "genres": genres or ["Drama"],
                "director": director,
                "cast": ["Ensemble"],
                "rating": rating,
                "metascore": round(rating * 10),
                "budget": budget,
                "revenue": revenue,
                "profit": profit,
                "roi": roi,
                "runtime": 120,
                "country": "USA",
                "synopsis": f"Custom imported record for {title}.",
                "poster": "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=300&q=80"
            })
            idx += 1

        if new_movies:
            CURRENT_MOVIES = new_movies
            return jsonify({
                "success": True,
                "message": f"Successfully loaded {len(new_movies)} custom movies!",
                "count": len(new_movies)
            })
        return jsonify({"success": False, "error": "No valid movie rows found in CSV."}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/reset", methods=["POST"])
def reset_dataset():
    """Resets dataset to standard 72 movies."""
    global CURRENT_MOVIES
    CURRENT_MOVIES = load_movies()
    return jsonify({"success": True, "message": "Restored benchmark 72 movie dataset", "count": len(CURRENT_MOVIES)})

@app.route("/api/export/csv", methods=["GET"])
def export_csv():
    """Download current dataset as CSV."""
    csv_path = os.path.join(BASE_DIR, "data", "movies.csv")
    if os.path.exists(csv_path):
        return send_file(csv_path, mimetype="text/csv", as_attachment=True, download_name="cinemetrics_export.csv")
    return jsonify({"error": "File not found"}), 404

@app.route("/api/export/json", methods=["GET"])
def export_json():
    """Download current dataset as JSON."""
    return Response(
        json.dumps(CURRENT_MOVIES, indent=2),
        mimetype="application/json",
        headers={"Content-Disposition": "attachment;filename=cinemetrics_export.json"}
    )

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    print(f"🎬 Starting CineMetrics Flask Server on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
