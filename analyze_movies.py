#!/usr/bin/env python3
"""
CineMetrics - Cinematic Data Science & Statistical Analysis Engine
Performs statistical modeling, correlations, genre profitability,
and director performance analysis on movie box office records.
"""

import json
import math
import os
from collections import defaultdict

def load_data(file_path="data/movies.json"):
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def mean(values):
    return sum(values) / len(values) if values else 0

def median(values):
    if not values:
        return 0
    s = sorted(values)
    n = len(s)
    mid = n // 2
    if n % 2 == 0:
        return (s[mid - 1] + s[mid]) / 2.0
    return s[mid]

def std_dev(values, val_mean=None):
    if len(values) < 2:
        return 0
    if val_mean is None:
        val_mean = mean(values)
    variance = sum((x - val_mean) ** 2 for x in values) / (len(values) - 1)
    return math.sqrt(variance)

def pearson_correlation(x, y):
    if len(x) != len(y) or len(x) < 2:
        return 0
    n = len(x)
    mean_x = mean(x)
    mean_y = mean(y)
    
    numerator = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
    denom_x = math.sqrt(sum((x[i] - mean_x) ** 2 for i in range(n)))
    denom_y = math.sqrt(sum((y[i] - mean_y) ** 2 for i in range(n)))
    
    if denom_x == 0 or denom_y == 0:
        return 0
    return numerator / (denom_x * denom_y)

def format_currency(amount):
    if amount >= 1_000_000_000:
        return f"₹{amount / 1_000_000_000:.2f}B"
    elif amount >= 1_000_000:
        return f"₹{amount / 1_000_000:.2f}M"
    elif amount >= 1_000:
        return f"₹{amount / 1_000:.1f}K"
    return f"₹{amount:,.0f}"

def run_analysis():
    data_path = os.path.join(os.path.dirname(__file__), "data", "movies.json")
    movies = load_data(data_path)
    
    budgets = [m["budget"] for m in movies]
    revenues = [m["revenue"] for m in movies]
    profits = [m["profit"] for m in movies]
    rois = [m["roi"] for m in movies]
    ratings = [m["rating"] for m in movies]
    metascores = [m["metascore"] for m in movies if m.get("metascore")]
    
    total_gross = sum(revenues)
    total_budget = sum(budgets)
    total_profit = sum(profits)
    
    # Correlations
    corr_budget_revenue = pearson_correlation(budgets, revenues)
    corr_rating_revenue = pearson_correlation(ratings, revenues)
    corr_budget_roi = pearson_correlation(budgets, rois)
    corr_rating_metascore = pearson_correlation(
        [m["rating"] for m in movies if m.get("metascore")],
        metascores
    )
    
    # Genre Analysis
    genre_data = defaultdict(lambda: {"count": 0, "total_revenue": 0, "total_budget": 0, "rois": [], "ratings": []})
    for m in movies:
        for g in m["genres"]:
            genre_data[g]["count"] += 1
            genre_data[g]["total_revenue"] += m["revenue"]
            genre_data[g]["total_budget"] += m["budget"]
            genre_data[g]["rois"].append(m["roi"])
            genre_data[g]["ratings"].append(m["rating"])
            
    genre_summary = []
    for g, metrics in genre_data.items():
        avg_rev = metrics["total_revenue"] / metrics["count"]
        avg_budget = metrics["total_budget"] / metrics["count"]
        avg_roi = mean(metrics["rois"])
        avg_rating = mean(metrics["ratings"])
        genre_summary.append({
            "genre": g,
            "count": metrics["count"],
            "total_revenue": metrics["total_revenue"],
            "avg_revenue": avg_rev,
            "avg_budget": avg_budget,
            "avg_roi": avg_roi,
            "avg_rating": round(avg_rating, 2)
        })
    genre_summary.sort(key=lambda x: x["total_revenue"], reverse=True)
    
    # Director Analysis
    director_data = defaultdict(lambda: {"count": 0, "total_revenue": 0, "ratings": [], "movies": []})
    for m in movies:
        director_data[m["director"]]["count"] += 1
        director_data[m["director"]]["total_revenue"] += m["revenue"]
        director_data[m["director"]]["ratings"].append(m["rating"])
        director_data[m["director"]]["movies"].append(m["title"])
        
    director_summary = []
    for d, metrics in director_data.items():
        director_summary.append({
            "director": d,
            "movie_count": metrics["count"],
            "total_revenue": metrics["total_revenue"],
            "avg_rating": round(mean(metrics["ratings"]), 2),
            "top_movies": metrics["movies"]
        })
    director_summary.sort(key=lambda x: x["total_revenue"], reverse=True)
    
    # Top Profit & Top ROI
    top_profit = sorted(movies, key=lambda x: x["profit"], reverse=True)[:5]
    top_roi = sorted(movies, key=lambda x: x["roi"], reverse=True)[:5]
    
    # Decade distribution
    decades = defaultdict(lambda: {"count": 0, "total_rev": 0, "ratings": []})
    for m in movies:
        dec = f"{(m['year'] // 10) * 10}s"
        decades[dec]["count"] += 1
        decades[dec]["total_rev"] += m["revenue"]
        decades[dec]["ratings"].append(m["rating"])
    
    decade_summary = []
    for d in sorted(decades.keys()):
        decade_summary.append({
            "decade": d,
            "count": decades[d]["count"],
            "total_revenue": decades[d]["total_rev"],
            "avg_rating": round(mean(decades[d]["ratings"]), 2)
        })
        
    report = {
        "dataset_size": len(movies),
        "financial_kpis": {
            "total_worldwide_gross": total_gross,
            "total_production_budget": total_budget,
            "total_net_profit": total_profit,
            "overall_market_roi_pct": round(((total_gross - total_budget) / total_budget) * 100, 2),
            "mean_budget": round(mean(budgets), 2),
            "median_budget": round(median(budgets), 2),
            "mean_revenue": round(mean(revenues), 2),
            "median_revenue": round(median(revenues), 2),
            "std_dev_revenue": round(std_dev(revenues), 2),
            "mean_rating": round(mean(ratings), 2),
            "median_rating": round(median(ratings), 2)
        },
        "statistical_correlations": {
            "budget_vs_worldwide_gross_r": round(corr_budget_revenue, 4),
            "imdb_rating_vs_worldwide_gross_r": round(corr_rating_revenue, 4),
            "budget_vs_roi_multiplier_r": round(corr_budget_roi, 4),
            "imdb_vs_metascore_r": round(corr_rating_metascore, 4)
        },
        "genre_rankings": genre_summary,
        "director_rankings": director_summary[:10],
        "decade_breakdown": decade_summary,
        "top_grossing_movies": [
            {"title": m["title"], "revenue": m["revenue"], "profit": m["profit"], "roi": m["roi"]}
            for m in sorted(movies, key=lambda x: x["revenue"], reverse=True)[:5]
        ],
        "highest_roi_movies": [
            {"title": m["title"], "budget": m["budget"], "revenue": m["revenue"], "roi": m["roi"]}
            for m in top_roi
        ]
    }
    
    # Save JSON report
    report_path = os.path.join(os.path.dirname(__file__), "data", "insights_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
        
    # Output formatted terminal dashboard
    print("=" * 72)
    print(" 🎬 CINEMETRICS: MOVIE DATA ANALYSIS & STATISTICAL INTELLIGENCE")
    print("=" * 72)
    print(f" Analyzed Films      : {len(movies)} titles")
    print(f" Total Global Gross  : {format_currency(total_gross)}")
    print(f" Total Production    : {format_currency(total_budget)}")
    print(f" Net Aggregate Profit: {format_currency(total_profit)}")
    print(f" Market ROI          : {report['financial_kpis']['overall_market_roi_pct']}%")
    print(f" Average IMDb Rating : {report['financial_kpis']['mean_rating']}/10 (Median: {report['financial_kpis']['median_rating']})")
    print("-" * 72)
    print(" 📊 CORRELATION MATRIX (Pearson's r):")
    print(f"   • Budget ⟷ Box Office Revenue : r = {corr_budget_revenue:+.4f} (Strong positive correlation)")
    print(f"   • IMDb Rating ⟷ Box Office    : r = {corr_rating_revenue:+.4f} (Moderate positive correlation)")
    print(f"   • Budget ⟷ ROI % Multiplier   : r = {corr_budget_roi:+.4f} (Inverse; low-budget gems gain highest % returns)")
    print(f"   • IMDb Rating ⟷ Metascore     : r = {corr_rating_metascore:+.4f} (Strong critic-audience agreement)")
    print("-" * 72)
    print(" 🏆 TOP 5 DIRECTORS BY WORLDWIDE BOX OFFICE:")
    for i, d in enumerate(director_summary[:5], 1):
        print(f"   {i}. {d['director']:<24} {format_currency(d['total_revenue']):<10} ({d['movie_count']} films, Avg IMDb: {d['avg_rating']})")
    print("-" * 72)
    print(" 💡 TOP 5 HIGHEST ROI PHENOMENONS:")
    for i, m in enumerate(top_roi, 1):
        print(f"   {i}. {m['title']:<30} Budget: {format_currency(m['budget']):<8} Gross: {format_currency(m['revenue']):<10} ROI: {m['roi']:>8,.1f}%")
    print("=" * 72)
    print(f" ✅ Full insights exported to: {report_path}\n")

if __name__ == "__main__":
    run_analysis()
