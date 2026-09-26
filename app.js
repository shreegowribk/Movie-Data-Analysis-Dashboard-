/**
 * CineMetrics - Movie Data Analysis Dashboard Application Logic
 */

// Application State
const state = {
  allMovies: [],
  filteredMovies: [],
  activeGenre: 'all',
  activeDecade: 'all',
  activeBudgetTier: 'all',
  minRating: 6.0,
  searchQuery: '',
  sortBy: 'revenue-desc',
  pageSize: 12,
  displayedCount: 12,
  viewMode: 'grid', // 'grid' | 'table'
  charts: {
    scatter: null,
    genre: null,
    decade: null,
    directors: null,
    ratingRoi: null
  },
  uploadedData: null
};

// Color palettes for genres & charts
const GENRE_COLORS = {
  'Action': '#ff2a54',
  'Adventure': '#f59e0b',
  'Sci-Fi': '#00d2ff',
  'Drama': '#8b5cf6',
  'Animation': '#10b981',
  'Comedy': '#ec4899',
  'Crime': '#e11d48',
  'Horror': '#f43f5e',
  'Romance': '#fb7185',
  'Biography': '#38bdf8',
  'Thriller': '#a855f7',
  'Fantasy': '#6366f1',
  'Music': '#14b8a6',
  'History': '#d97706',
  'Default': '#94a3b8'
};

// Utility: Currency Formatter
function formatCurrency(val, compact = true) {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  if (compact) {
    if (Math.abs(val) >= 1_000_000_000) {
      return `₹${(val / 1_000_000_000).toFixed(2)}B`;
    } else if (Math.abs(val) >= 1_000_000) {
      return `₹${(val / 1_000_000).toFixed(1)}M`;
    } else if (Math.abs(val) >= 1_000) {
      return `₹${(val / 1_000).toFixed(0)}K`;
    }
  }
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
}

// Utility: Toast notifications
function showToast(message, icon = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i data-lucide="${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  // Load initial database
  if (typeof MOVIES_DATABASE !== 'undefined' && Array.isArray(MOVIES_DATABASE)) {
    state.allMovies = JSON.parse(JSON.stringify(MOVIES_DATABASE));
  } else {
    console.error('MOVIES_DATABASE not found, initializing empty fallback.');
    state.allMovies = [];
  }

  // Ensure computed fields
  state.allMovies.forEach(m => {
    if (!m.profit) m.profit = m.revenue - m.budget;
    if (m.roi === undefined) {
      m.roi = m.budget > 0 ? Number((((m.revenue - m.budget) / m.budget) * 100).toFixed(2)) : 0;
    }
  });

  state.filteredMovies = [...state.allMovies];

  setupEventListeners();
  applyFiltersAndRender();

  // Initial Lucide icons
  if (window.lucide) lucide.createIcons();
});

// Setup Event Listeners
function setupEventListeners() {
  // Search input
  const searchInput = document.getElementById('searchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      if (btnClearSearch) {
        btnClearSearch.classList.toggle('hidden', state.searchQuery.length === 0);
      }
      applyFiltersAndRender();
    });
  }

  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      state.searchQuery = '';
      btnClearSearch.classList.add('hidden');
      applyFiltersAndRender();
    });
  }

  // Genre chips
  const genreChips = document.querySelectorAll('.genre-chip');
  genreChips.forEach(chip => {
    chip.addEventListener('click', () => {
      genreChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.activeGenre = chip.getAttribute('data-genre') || 'all';
      applyFiltersAndRender();
    });
  });

  // Decade filter
  const filterDecade = document.getElementById('filterDecade');
  if (filterDecade) {
    filterDecade.addEventListener('change', (e) => {
      state.activeDecade = e.target.value;
      applyFiltersAndRender();
    });
  }

  // Budget Tier
  const filterBudgetTier = document.getElementById('filterBudgetTier');
  if (filterBudgetTier) {
    filterBudgetTier.addEventListener('change', (e) => {
      state.activeBudgetTier = e.target.value;
      applyFiltersAndRender();
    });
  }

  // Rating slider
  const filterRating = document.getElementById('filterRating');
  const ratingValueDisplay = document.getElementById('ratingValueDisplay');
  if (filterRating) {
    filterRating.addEventListener('input', (e) => {
      state.minRating = parseFloat(e.target.value);
      if (ratingValueDisplay) ratingValueDisplay.textContent = `${state.minRating.toFixed(1)}+`;
      applyFiltersAndRender();
    });
  }

  // Sorting
  const filterSort = document.getElementById('filterSort');
  if (filterSort) {
    filterSort.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      applyFiltersAndRender();
    });
  }

  // Preset Selector
  const datasetPreset = document.getElementById('datasetPreset');
  if (datasetPreset) {
    datasetPreset.addEventListener('change', (e) => {
      applyPreset(e.target.value);
    });
  }

  // Reset Filters Button
  const btnResetFilters = document.getElementById('btnResetFilters');
  if (btnResetFilters) {
    btnResetFilters.addEventListener('click', () => {
      resetAllFilters();
      showToast('Filters reset to default view', 'check-circle');
    });
  }

  // View Mode Toggle (Grid vs Table)
  const btnViewGrid = document.getElementById('btnViewGrid');
  const btnViewTable = document.getElementById('btnViewTable');
  const movieGrid = document.getElementById('movieGrid');
  const tableWrapper = document.getElementById('tableWrapper');

  if (btnViewGrid && btnViewTable) {
    btnViewGrid.addEventListener('click', () => {
      state.viewMode = 'grid';
      btnViewGrid.classList.add('active');
      btnViewTable.classList.remove('active');
      movieGrid.classList.remove('hidden');
      tableWrapper.classList.add('hidden');
    });

    btnViewTable.addEventListener('click', () => {
      state.viewMode = 'table';
      btnViewTable.classList.add('active');
      btnViewGrid.classList.remove('active');
      tableWrapper.classList.remove('hidden');
      movieGrid.classList.add('hidden');
    });
  }

  // Load More Button
  const btnLoadMore = document.getElementById('btnLoadMore');
  if (btnLoadMore) {
    btnLoadMore.addEventListener('click', () => {
      state.displayedCount += state.pageSize;
      renderMovieCatalog();
    });
  }

  // Table Column Header Sort
  const tableHeaders = document.querySelectorAll('#movieTable th[data-sort]');
  tableHeaders.forEach(th => {
    th.addEventListener('click', () => {
      const sortKey = th.getAttribute('data-sort');
      handleTableSort(sortKey);
    });
  });

  // Export Buttons
  const btnExportData = document.getElementById('btnExportData');
  if (btnExportData) {
    btnExportData.addEventListener('click', () => exportDataCSV());
  }

  const btnFooterExportJson = document.getElementById('btnFooterExportJson');
  if (btnFooterExportJson) {
    btnFooterExportJson.addEventListener('click', () => exportDataJSON());
  }

  const btnFooterExportCsv = document.getElementById('btnFooterExportCsv');
  if (btnFooterExportCsv) {
    btnFooterExportCsv.addEventListener('click', () => exportDataCSV());
  }

  // Modal Closers
  const movieModal = document.getElementById('movieModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  if (modalCloseBtn && movieModal) {
    modalCloseBtn.addEventListener('click', () => movieModal.classList.add('hidden'));
    movieModal.addEventListener('click', (e) => {
      if (e.target === movieModal) movieModal.classList.add('hidden');
    });
  }

  // CSV Import Modal Handlers
  setupImportModal();

  // Chart category tabs
  const chartTabs = document.querySelectorAll('.chart-view-tab');
  chartTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      chartTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.getAttribute('data-tab');
      filterChartDisplay(cat);
    });
  });
}

// Preset application
function applyPreset(preset) {
  resetAllFilters(false);
  const filterSort = document.getElementById('filterSort');

  switch (preset) {
    case 'billion':
      state.filteredMovies = state.allMovies.filter(m => m.revenue >= 1_000_000_000);
      if (filterSort) filterSort.value = 'revenue-desc';
      state.sortBy = 'revenue-desc';
      showToast('Loaded Billion-Rupee Box Office Club (Gross >= ₹1B)', 'sparkles');
      break;
    case 'high-roi':
      state.filteredMovies = state.allMovies.filter(m => m.roi >= 1000);
      if (filterSort) filterSort.value = 'roi-desc';
      state.sortBy = 'roi-desc';
      showToast('Loaded Ultra-High ROI Sleeper Hits (>1,000%)', 'zap');
      if (typeof confetti === 'function') confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      break;
    case 'modern':
      state.filteredMovies = state.allMovies.filter(m => m.year >= 2015);
      showToast('Loaded Modern Era Films (2015–2024)', 'film');
      break;
    case 'critics':
      state.filteredMovies = state.allMovies.filter(m => m.rating >= 8.5);
      if (filterSort) filterSort.value = 'rating-desc';
      state.sortBy = 'rating-desc';
      showToast('Loaded Critically Acclaimed Masterpieces (IMDb 8.5+)', 'award');
      break;
    default:
      state.filteredMovies = [...state.allMovies];
      showToast('Showing all movies in database', 'check-circle');
  }

  sortMovies(state.filteredMovies);
  updateKPIs();
  updateSpotlight();
  renderCharts();
  renderMovieCatalog();
}

// Reset Filters
function resetAllFilters(reApply = true) {
  state.activeGenre = 'all';
  state.activeDecade = 'all';
  state.activeBudgetTier = 'all';
  state.minRating = 6.0;
  state.searchQuery = '';
  state.sortBy = 'revenue-desc';
  state.displayedCount = state.pageSize;

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  const btnClearSearch = document.getElementById('btnClearSearch');
  if (btnClearSearch) btnClearSearch.classList.add('hidden');

  const filterDecade = document.getElementById('filterDecade');
  if (filterDecade) filterDecade.value = 'all';

  const filterBudgetTier = document.getElementById('filterBudgetTier');
  if (filterBudgetTier) filterBudgetTier.value = 'all';

  const filterRating = document.getElementById('filterRating');
  if (filterRating) filterRating.value = '6.0';
  const ratingValueDisplay = document.getElementById('ratingValueDisplay');
  if (ratingValueDisplay) ratingValueDisplay.textContent = '6.0+';

  const filterSort = document.getElementById('filterSort');
  if (filterSort) filterSort.value = 'revenue-desc';

  const genreChips = document.querySelectorAll('.genre-chip');
  genreChips.forEach(c => {
    c.classList.toggle('active', c.getAttribute('data-genre') === 'all');
  });

  if (reApply) {
    const datasetPreset = document.getElementById('datasetPreset');
    if (datasetPreset) datasetPreset.value = 'all';
    applyFiltersAndRender();
  }
}

// Master Filter & Sort Pipeline
function applyFiltersAndRender() {
  state.filteredMovies = state.allMovies.filter(movie => {
    // Search query match
    if (state.searchQuery) {
      const matchTitle = movie.title.toLowerCase().includes(state.searchQuery);
      const matchDirector = movie.director.toLowerCase().includes(state.searchQuery);
      const matchCast = Array.isArray(movie.cast) && movie.cast.some(actor => actor.toLowerCase().includes(state.searchQuery));
      const matchGenre = Array.isArray(movie.genres) && movie.genres.some(g => g.toLowerCase().includes(state.searchQuery));
      if (!matchTitle && !matchDirector && !matchCast && !matchGenre) return false;
    }

    // Genre filter
    if (state.activeGenre !== 'all') {
      if (!movie.genres || !movie.genres.includes(state.activeGenre)) {
        return false;
      }
    }

    // Decade filter
    if (state.activeDecade !== 'all') {
      const decStart = parseInt(state.activeDecade.replace('s', ''));
      if (movie.year < decStart || movie.year > decStart + 9) {
        return false;
      }
    }

    // Budget Tier
    if (state.activeBudgetTier !== 'all') {
      if (state.activeBudgetTier === 'low' && movie.budget >= 25_000_000) return false;
      if (state.activeBudgetTier === 'mid' && (movie.budget < 25_000_000 || movie.budget > 100_000_000)) return false;
      if (state.activeBudgetTier === 'high' && movie.budget <= 100_000_000) return false;
    }

    // Rating Slider
    if (movie.rating < state.minRating) {
      return false;
    }

    return true;
  });

  // Sort
  sortMovies(state.filteredMovies);

  // Update KPI Section
  updateKPIs();

  // Update Hero Spotlight
  updateSpotlight();

  // Render Visual Charts
  renderCharts();

  // Reset pagination count on filter change & render catalog
  state.displayedCount = state.pageSize;
  renderMovieCatalog();
}

// Sorting logic
function sortMovies(list) {
  switch (state.sortBy) {
    case 'revenue-desc':
      list.sort((a, b) => b.revenue - a.revenue);
      break;
    case 'revenue-asc':
      list.sort((a, b) => a.revenue - b.revenue);
      break;
    case 'roi-desc':
      list.sort((a, b) => b.roi - a.roi);
      break;
    case 'rating-desc':
      list.sort((a, b) => b.rating - a.rating);
      break;
    case 'budget-desc':
      list.sort((a, b) => b.budget - a.budget);
      break;
    case 'year-desc':
      list.sort((a, b) => b.year - a.year);
      break;
    case 'title-asc':
      list.sort((a, b) => a.title.localeCompare(b.title));
      break;
    default:
      list.sort((a, b) => b.revenue - a.revenue);
  }
}

// Handle Table Column Header Click Sort
function handleTableSort(columnKey) {
  if (state.sortBy === `${columnKey}-desc`) {
    state.sortBy = `${columnKey}-asc`;
  } else {
    state.sortBy = `${columnKey}-desc`;
  }
  const filterSort = document.getElementById('filterSort');
  if (filterSort) filterSort.value = state.sortBy;
  applyFiltersAndRender();
}

// Update Executive KPI Cards
function updateKPIs() {
  const count = state.filteredMovies.length;
  const kpiFilterCounter = document.getElementById('kpiFilterCounter');
  if (kpiFilterCounter) {
    kpiFilterCounter.textContent = `Showing ${count} of ${state.allMovies.length} films`;
  }

  if (count === 0) {
    document.getElementById('kpiTotalRevenue').textContent = '₹0';
    document.getElementById('kpiTotalBudget').textContent = '₹0';
    document.getElementById('kpiOverallRoi').textContent = '0%';
    document.getElementById('kpiAvgRating').innerHTML = '0 <small class="text-muted">/10</small>';
    return;
  }

  const totalRev = state.filteredMovies.reduce((acc, m) => acc + m.revenue, 0);
  const totalBudget = state.filteredMovies.reduce((acc, m) => acc + m.budget, 0);
  const totalProfit = totalRev - totalBudget;
  const avgRev = totalRev / count;
  const avgBudget = totalBudget / count;
  const overallRoi = totalBudget > 0 ? ((totalProfit / totalBudget) * 100).toFixed(1) : 0;
  const avgRating = (state.filteredMovies.reduce((acc, m) => acc + m.rating, 0) / count).toFixed(2);
  const metascores = state.filteredMovies.filter(m => m.metascore).map(m => m.metascore);
  const avgMetascore = metascores.length > 0 ? Math.round(metascores.reduce((a, b) => a + b, 0) / metascores.length) : 'N/A';

  // Find top ROI and top rated in subset
  const topRoiFilm = [...state.filteredMovies].sort((a, b) => b.roi - a.roi)[0];
  const topRatedFilm = [...state.filteredMovies].sort((a, b) => b.rating - a.rating)[0];

  // Set DOM Values
  document.getElementById('kpiTotalRevenue').textContent = formatCurrency(totalRev, true);
  document.getElementById('kpiRevenuePill').textContent = `+${formatCurrency(totalProfit, true)} Profit`;
  document.getElementById('kpiAvgRevenue').textContent = formatCurrency(avgRev, true);

  document.getElementById('kpiTotalBudget').textContent = formatCurrency(totalBudget, true);
  document.getElementById('kpiAvgBudget').textContent = formatCurrency(avgBudget, true);

  document.getElementById('kpiOverallRoi').textContent = `${Number(overallRoi).toLocaleString()}%`;
  document.getElementById('kpiMultiplierPill').textContent = `${(totalRev / (totalBudget || 1)).toFixed(2)}x Return`;
  if (topRoiFilm) {
    document.getElementById('kpiTopRoiFilm').textContent = `${topRoiFilm.title} (${Number(topRoiFilm.roi).toLocaleString()}%)`;
  }

  document.getElementById('kpiAvgRating').innerHTML = `${avgRating} <small class="text-muted">/10</small>`;
  document.getElementById('kpiMetascorePill').textContent = `Metascore: ${avgMetascore}`;
  if (topRatedFilm) {
    document.getElementById('kpiTopRatedFilm').textContent = `${topRatedFilm.title} (${topRatedFilm.rating})`;
  }

  // Also update hero stats strip
  const stripTotalGross = document.getElementById('stripTotalGross');
  if (stripTotalGross) stripTotalGross.textContent = formatCurrency(totalRev, true);
  const stripTotalMovies = document.getElementById('stripTotalMovies');
  if (stripTotalMovies) stripTotalMovies.textContent = count;
  const stripAvgRoi = document.getElementById('stripAvgRoi');
  if (stripAvgRoi) stripAvgRoi.textContent = `${Number(overallRoi).toFixed(0)}%`;
  const stripAvgRating = document.getElementById('stripAvgRating');
  if (stripAvgRating) stripAvgRating.textContent = avgRating;
}

// Update Spotlight Card
function updateSpotlight() {
  const leader = state.filteredMovies.length > 0 
    ? [...state.filteredMovies].sort((a, b) => b.revenue - a.revenue)[0]
    : state.allMovies[0];

  if (!leader) return;

  const spotlightPoster = document.getElementById('spotlightPoster');
  const spotlightTitle = document.getElementById('spotlightTitle');
  const spotlightDirector = document.getElementById('spotlightDirector');
  const spotlightTags = document.getElementById('spotlightTags');
  const spotlightGross = document.getElementById('spotlightGross');
  const spotlightBudget = document.getElementById('spotlightBudget');
  const spotlightProfit = document.getElementById('spotlightProfit');

  if (spotlightPoster) {
    spotlightPoster.src = leader.poster || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=300&q=80';
    spotlightPoster.onerror = () => {
      spotlightPoster.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=300&q=80';
    };
  }
  if (spotlightTitle) spotlightTitle.textContent = `${leader.title} (${leader.year})`;
  if (spotlightDirector) spotlightDirector.textContent = leader.director;
  if (spotlightGross) spotlightGross.textContent = formatCurrency(leader.revenue, true);
  if (spotlightBudget) spotlightBudget.textContent = formatCurrency(leader.budget, true);
  if (spotlightProfit) {
    spotlightProfit.textContent = `+${formatCurrency(leader.profit, true)} (${Number(leader.roi).toLocaleString()}% ROI)`;
  }

  if (spotlightTags && leader.genres) {
    spotlightTags.innerHTML = leader.genres.map(g => `<span class="tag">${g}</span>`).join('');
  }
}

// Render Charts via Chart.js
function renderCharts() {
  renderScatterChart();
  renderGenreDoughnut();
  renderDecadeTrends();
  renderDirectorsChart();
  renderRatingRoiChart();
}

// Chart 1: Budget vs Revenue Scatter / Bubble Plot
function renderScatterChart() {
  const ctx = document.getElementById('budgetRevenueScatterChart');
  if (!ctx) return;

  if (state.charts.scatter) {
    state.charts.scatter.destroy();
  }

  // Create points
  const points = state.filteredMovies.map(m => ({
    x: m.budget / 1_000_000, // ₹ Millions
    y: m.revenue / 1_000_000, // ₹ Millions
    r: Math.max(5, Math.min(22, Math.sqrt(Math.max(0, m.roi)) * 0.35 + 4)),
    movie: m
  }));

  state.charts.scatter = new Chart(ctx, {
    type: 'bubble',
    data: {
      datasets: [{
        label: 'Films Analyzed',
        data: points,
        backgroundColor: points.map(p => {
          const g = p.movie.genres ? p.movie.genres[0] : 'Default';
          return (GENRE_COLORS[g] || '#00d2ff') + 'bb';
        }),
        borderColor: points.map(p => {
          const g = p.movie.genres ? p.movie.genres[0] : 'Default';
          return GENRE_COLORS[g] || '#00d2ff';
        }),
        borderWidth: 1.5,
        hoverBorderWidth: 3,
        hoverBorderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(11, 15, 25, 0.95)',
          titleFont: { family: 'Outfit', size: 14, weight: 'bold' },
          bodyFont: { family: 'Inter', size: 12 },
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            title: (items) => {
              const p = items[0].raw;
              return `${p.movie.title} (${p.movie.year})`;
            },
            label: (item) => {
              const m = item.raw.movie;
              return [
                `Director: ${m.director}`,
                `Budget: ${formatCurrency(m.budget)}`,
                `Gross Revenue: ${formatCurrency(m.revenue)}`,
                `ROI: ${Number(m.roi).toLocaleString()}% (${(m.revenue / (m.budget || 1)).toFixed(1)}x)`,
                `IMDb Rating: ★ ${m.rating}/10`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Production Budget (₹ Millions)',
            color: '#94a3b8',
            font: { family: 'Inter', size: 11, weight: '600' }
          },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#64748b',
            callback: v => `₹${v}M`
          }
        },
        y: {
          title: {
            display: true,
            text: 'Worldwide Gross Box Office (₹ Millions)',
            color: '#94a3b8',
            font: { family: 'Inter', size: 11, weight: '600' }
          },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#64748b',
            callback: v => `₹${v}M`
          }
        }
      },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const selectedMovie = points[index].movie;
          openMovieModal(selectedMovie);
        }
      }
    }
  });
}

// Chart 2: Revenue Share by Genre (Doughnut)
function renderGenreDoughnut() {
  const ctx = document.getElementById('genreRevenueDoughnutChart');
  if (!ctx) return;

  if (state.charts.genre) {
    state.charts.genre.destroy();
  }

  // Aggregate by genre
  const genreTotals = {};
  state.filteredMovies.forEach(m => {
    if (m.genres && Array.isArray(m.genres)) {
      m.genres.forEach(g => {
        genreTotals[g] = (genreTotals[g] || 0) + m.revenue;
      });
    }
  });

  const sortedGenres = Object.entries(genreTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7); // Top 7 genres

  const labels = sortedGenres.map(g => g[0]);
  const data = sortedGenres.map(g => (g[1] / 1_000_000_000).toFixed(2));
  const bgColors = labels.map(g => GENRE_COLORS[g] || '#64748b');

  state.charts.genre = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: bgColors,
        borderColor: '#0b0f19',
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#94a3b8',
            font: { family: 'Outfit', size: 11 },
            boxWidth: 12,
            padding: 10
          }
        },
        tooltip: {
          backgroundColor: 'rgba(11, 15, 25, 0.95)',
          padding: 12,
          callbacks: {
            label: (item) => ` ${item.label}: ₹${item.raw} Billion Gross`
          }
        }
      }
    }
  });
}

// Chart 3: Era & Decade Evolution (Line / Area)
function renderDecadeTrends() {
  const ctx = document.getElementById('decadeTrendsLineChart');
  if (!ctx) return;

  if (state.charts.decade) {
    state.charts.decade.destroy();
  }

  // Group by decade
  const decadeMap = {};
  state.filteredMovies.forEach(m => {
    const dec = `${Math.floor(m.year / 10) * 10}s`;
    if (!decadeMap[dec]) {
      decadeMap[dec] = { totalRevenue: 0, totalBudget: 0, count: 0, totalRating: 0 };
    }
    decadeMap[dec].totalRevenue += m.revenue;
    decadeMap[dec].totalBudget += m.budget;
    decadeMap[dec].totalRating += m.rating;
    decadeMap[dec].count += 1;
  });

  const sortedDecades = Object.keys(decadeMap).sort();
  const revData = sortedDecades.map(d => (decadeMap[d].totalRevenue / 1_000_000_000).toFixed(2));
  const budgetData = sortedDecades.map(d => (decadeMap[d].totalBudget / 1_000_000_000).toFixed(2));
  const ratingData = sortedDecades.map(d => (decadeMap[d].totalRating / decadeMap[d].count).toFixed(2));

  state.charts.decade = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedDecades,
      datasets: [
        {
          label: 'Total Box Office (₹B)',
          data: revData,
          borderColor: '#00d2ff',
          backgroundColor: 'rgba(0, 210, 255, 0.12)',
          fill: true,
          tension: 0.35,
          yAxisID: 'y'
        },
        {
          label: 'Production Budget (₹B)',
          data: budgetData,
          borderColor: '#ff2a54',
          backgroundColor: 'rgba(255, 42, 84, 0.08)',
          fill: true,
          tension: 0.35,
          yAxisID: 'y'
        },
        {
          label: 'Avg IMDb Rating',
          data: ratingData,
          borderColor: '#ffb800',
          borderDash: [5, 5],
          pointRadius: 4,
          tension: 0.2,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#94a3b8', font: { family: 'Outfit', size: 11 }, boxWidth: 12 }
        },
        tooltip: {
          backgroundColor: 'rgba(11, 15, 25, 0.95)',
          padding: 12
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b' }
        },
        y: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'Billions (₹B)', color: '#94a3b8' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', callback: v => `₹${v}B` }
        },
        y1: {
          type: 'linear',
          position: 'right',
          min: 6,
          max: 10,
          title: { display: true, text: 'IMDb Score', color: '#ffb800' },
          grid: { drawOnChartArea: false },
          ticks: { color: '#ffb800', stepSize: 1 }
        }
      }
    }
  });
}

// Chart 4: Top Directors by Gross (Horizontal Bar)
function renderDirectorsChart() {
  const ctx = document.getElementById('directorsGrossBarChart');
  if (!ctx) return;

  if (state.charts.directors) {
    state.charts.directors.destroy();
  }

  const dirMap = {};
  state.filteredMovies.forEach(m => {
    const dir = m.director;
    if (!dirMap[dir]) {
      dirMap[dir] = { totalRevenue: 0, count: 0, movies: [] };
    }
    dirMap[dir].totalRevenue += m.revenue;
    dirMap[dir].count += 1;
    dirMap[dir].movies.push(m.title);
  });

  const sortedDirs = Object.entries(dirMap)
    .sort((a, b) => b[1].totalRevenue - a[1].totalRevenue)
    .slice(0, 8);

  const labels = sortedDirs.map(d => d[0]);
  const revs = sortedDirs.map(d => (d[1].totalRevenue / 1_000_000_000).toFixed(2));

  state.charts.directors = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Gross (₹ Billions)',
        data: revs,
        backgroundColor: 'rgba(139, 92, 246, 0.75)',
        hoverBackgroundColor: '#8b5cf6',
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(11, 15, 25, 0.95)',
          padding: 12,
          callbacks: {
            label: (item) => {
              const dInfo = sortedDirs[item.dataIndex][1];
              return [
                `Total Gross: ₹${item.raw} Billion`,
                `Films: ${dInfo.count} (${dInfo.movies.slice(0, 2).join(', ')}${dInfo.movies.length > 2 ? '...' : ''})`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', callback: v => `₹${v}B` }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#e2e8f0', font: { family: 'Outfit', size: 12 } }
        }
      }
    }
  });
}

// Chart 5: IMDb Rating vs ROI Multiplier
function renderRatingRoiChart() {
  const ctx = document.getElementById('ratingRoiChart');
  if (!ctx) return;

  if (state.charts.ratingRoi) {
    state.charts.ratingRoi.destroy();
  }

  // Create points for rating vs ROI
  const dataPoints = state.filteredMovies.map(m => ({
    x: m.rating,
    y: Math.min(m.roi, 6000), // Cap visual outlier at 6000%
    movie: m
  }));

  state.charts.ratingRoi = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Rating vs ROI',
        data: dataPoints,
        backgroundColor: '#10b981aa',
        borderColor: '#10b981',
        pointRadius: 6,
        hoverRadius: 9
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(11, 15, 25, 0.95)',
          padding: 12,
          callbacks: {
            title: (items) => `${items[0].raw.movie.title} (${items[0].raw.movie.year})`,
            label: (item) => [
              `IMDb Rating: ★ ${item.raw.x}/10`,
              `ROI: ${Number(item.raw.movie.roi).toLocaleString()}%`,
              `Profit: +${formatCurrency(item.raw.movie.profit)}`
            ]
          }
        }
      },
      scales: {
        x: {
          min: 6,
          max: 9.5,
          title: { display: true, text: 'IMDb Audience Rating', color: '#94a3b8' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b' }
        },
        y: {
          title: { display: true, text: 'Return on Investment (ROI %)', color: '#94a3b8' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', callback: v => `${v}%` }
        }
      },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          openMovieModal(dataPoints[index].movie);
        }
      }
    }
  });
}

// Chart tab category filter
function filterChartDisplay(category) {
  const chartCards = document.querySelectorAll('.chart-card');
  chartCards.forEach(card => {
    const cardCat = card.getAttribute('data-category');
    if (category === 'all' || cardCat === category) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });
}

// Render Movie Catalog (Grid & Table)
function renderMovieCatalog() {
  const movieGrid = document.getElementById('movieGrid');
  const movieTableBody = document.getElementById('movieTableBody');
  const catalogStatus = document.getElementById('catalogStatus');
  const btnLoadMore = document.getElementById('btnLoadMore');

  const total = state.filteredMovies.length;
  const currentSlice = state.filteredMovies.slice(0, state.displayedCount);

  if (catalogStatus) {
    catalogStatus.textContent = `Showing ${Math.min(state.displayedCount, total)} of ${total} films`;
  }

  if (btnLoadMore) {
    btnLoadMore.classList.toggle('hidden', state.displayedCount >= total);
  }

  // Render Card Grid
  if (movieGrid) {
    if (total === 0) {
      movieGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <i data-lucide="film" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
          <h3>No movies found</h3>
          <p>Try loosening your search filters or resetting to default view.</p>
        </div>
      `;
    } else {
      movieGrid.innerHTML = currentSlice.map(movie => createMovieCardHTML(movie)).join('');
    }
  }

  // Render Table
  if (movieTableBody) {
    if (total === 0) {
      movieTableBody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-muted);">
            No movies match your current filter settings.
          </td>
        </tr>
      `;
    } else {
      movieTableBody.innerHTML = currentSlice.map(movie => createMovieTableRowHTML(movie)).join('');
    }
  }

  // Re-attach card click listeners
  attachCatalogItemEvents();

  if (window.lucide) lucide.createIcons();
}

// Movie Card Template
function createMovieCardHTML(m) {
  const roiClass = m.roi >= 1000 ? 'roi-mega' : (m.roi >= 300 ? 'roi-high' : 'roi-mod');
  const primaryGenre = m.genres && m.genres[0] ? m.genres[0] : 'Cinema';

  return `
    <div class="movie-card" data-id="${m.id}">
      <div class="card-poster-wrap">
        <img src="${m.poster || ''}" alt="${m.title} poster" class="card-poster" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=300&q=80';">
        <span class="card-badge-rating">
          <i data-lucide="star" style="width: 13px; height: 13px; fill: var(--accent-gold); color: var(--accent-gold);"></i>
          ${m.rating}
        </span>
        <span class="card-badge-year">${m.year}</span>
      </div>
      <div class="card-body">
        <div>
          <h3 class="card-title">${m.title}</h3>
          <p class="card-director">Dir. ${m.director}</p>
        </div>
        <div class="card-genres">
          ${(m.genres || []).map(g => `<span class="card-genre-pill">${g}</span>`).join('')}
        </div>
        <div class="card-financials">
          <div class="fin-row">
            <span class="fin-label">Worldwide Gross:</span>
            <span class="fin-val text-accent-cyan">${formatCurrency(m.revenue)}</span>
          </div>
          <div class="fin-row">
            <span class="fin-label">Budget:</span>
            <span class="fin-val">${formatCurrency(m.budget)}</span>
          </div>
          <div class="fin-row">
            <span class="fin-label">ROI Multiplier:</span>
            <span class="roi-chip ${roiClass}">${Number(m.roi).toLocaleString()}% (${(m.revenue / (m.budget || 1)).toFixed(1)}x)</span>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm card-action-btn">
          <i data-lucide="info"></i> Details
        </button>
      </div>
    </div>
  `;
}

// Movie Table Row Template
function createMovieTableRowHTML(m) {
  const roiClass = m.roi >= 1000 ? 'roi-mega' : (m.roi >= 300 ? 'roi-high' : 'roi-mod');
  return `
    <tr data-id="${m.id}">
      <td>
        <div class="tbl-title-cell">
          <img src="${m.poster || ''}" alt="" class="tbl-poster-thumb" onerror="this.style.display='none'">
          <span>${m.title}</span>
        </div>
      </td>
      <td>${m.year}</td>
      <td>${(m.genres || []).slice(0, 2).join(', ')}</td>
      <td>${m.director}</td>
      <td><span class="text-accent-gold font-bold">★ ${m.rating}</span></td>
      <td>${formatCurrency(m.budget)}</td>
      <td class="text-accent-cyan font-bold">${formatCurrency(m.revenue)}</td>
      <td class="text-accent-green">+${formatCurrency(m.profit)}</td>
      <td><span class="roi-chip ${roiClass}">${Number(m.roi).toLocaleString()}%</span></td>
      <td>
        <button class="btn btn-outline btn-sm tbl-action-btn" title="Inspect Movie">
          <i data-lucide="eye"></i>
        </button>
      </td>
    </tr>
  `;
}

// Attach event listeners to movie cards & table rows
function attachCatalogItemEvents() {
  document.querySelectorAll('.movie-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = parseInt(card.getAttribute('data-id'));
      const movie = state.allMovies.find(m => m.id === id);
      if (movie) openMovieModal(movie);
    });
  });

  document.querySelectorAll('#movieTableBody tr').forEach(row => {
    row.addEventListener('click', () => {
      const id = parseInt(row.getAttribute('data-id'));
      const movie = state.allMovies.find(m => m.id === id);
      if (movie) openMovieModal(movie);
    });
  });
}

// Open Movie Detail Modal
function openMovieModal(movie) {
  const modal = document.getElementById('movieModal');
  const content = document.getElementById('modalContent');
  if (!modal || !content) return;

  const budgetRatio = movie.revenue > 0 ? Math.min(100, Math.round((movie.budget / movie.revenue) * 100)) : 0;
  const profitRatio = 100 - budgetRatio;

  content.innerHTML = `
    <div class="modal-header-banner"></div>
    <div class="modal-movie-top">
      <img src="${movie.poster || ''}" alt="${movie.title}" class="modal-poster" onerror="this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=300&q=80';">
      <div class="modal-title-area">
        <h2 class="modal-title">${movie.title}</h2>
        <div class="modal-meta-row">
          <span><i data-lucide="calendar"></i> ${movie.year}</span>
          <span><i data-lucide="clock"></i> ${movie.runtime || 120} min</span>
          <span><i data-lucide="globe"></i> ${movie.country || 'USA'}</span>
          <span class="text-accent-gold"><i data-lucide="star"></i> IMDb ${movie.rating}/10</span>
          ${movie.metascore ? `<span>Metascore: <strong>${movie.metascore}</strong></span>` : ''}
        </div>
      </div>
    </div>

    <div class="modal-body">
      <div>
        <h4 class="modal-section-title">Plot Synopsis</h4>
        <p class="modal-synopsis">${movie.synopsis || 'No synopsis available for this title.'}</p>
      </div>

      <div>
        <h4 class="modal-section-title">Financial Breakdown & Profitability</h4>
        <div class="modal-grid-stats">
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">Worldwide Gross</span>
            <span class="modal-stat-val text-accent-cyan">${formatCurrency(movie.revenue)}</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">Production Budget</span>
            <span class="modal-stat-val">${formatCurrency(movie.budget)}</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">Net Profit</span>
            <span class="modal-stat-val text-accent-green">+${formatCurrency(movie.profit)}</span>
          </div>
          <div class="modal-stat-box">
            <span class="modal-stat-lbl">ROI Multiplier</span>
            <span class="modal-stat-val text-accent-gold">${Number(movie.roi).toLocaleString()}%</span>
          </div>
        </div>

        <div style="margin-top: 14px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">
            <span>Budget Share: ${budgetRatio}%</span>
            <span>Net Profit Share: ${profitRatio}%</span>
          </div>
          <div style="width: 100%; height: 8px; background: #1e293b; border-radius: 4px; display: flex; overflow: hidden;">
            <div style="width: ${budgetRatio}%; background: #ff2a54;"></div>
            <div style="width: ${profitRatio}%; background: #10b981;"></div>
          </div>
        </div>
      </div>

      <div>
        <h4 class="modal-section-title">Director & Lead Cast</h4>
        <p style="margin-bottom: 8px; font-size: 0.9rem;"><strong>Director:</strong> ${movie.director}</p>
        <div class="modal-cast-chips">
          ${(movie.cast || []).map(actor => `<span class="cast-chip"><i data-lucide="user"></i> ${actor}</span>`).join('')}
        </div>
      </div>

      ${movie.awards ? `
        <div class="modal-awards-box">
          <i data-lucide="award" style="width: 24px; height: 24px; flex-shrink: 0;"></i>
          <span>${movie.awards}</span>
        </div>
      ` : ''}
    </div>
  `;

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

// CSV Export
function exportDataCSV() {
  const headers = ['id', 'title', 'year', 'genres', 'director', 'rating', 'metascore', 'budget', 'revenue', 'profit', 'roi', 'runtime', 'country'];
  const rows = state.filteredMovies.map(m => [
    m.id,
    `"${(m.title || '').replace(/"/g, '""')}"`,
    m.year,
    `"${(m.genres || []).join(';')}"`,
    `"${(m.director || '').replace(/"/g, '""')}"`,
    m.rating,
    m.metascore || '',
    m.budget,
    m.revenue,
    m.profit,
    m.roi,
    m.runtime || '',
    `"${(m.country || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', 'cinemetrics_movie_analysis_export.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();

  showToast(`Exported ${state.filteredMovies.length} movies to CSV!`, 'file-spreadsheet');
}

// JSON Export
function exportDataJSON() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.filteredMovies, null, 2));
  const link = document.createElement('a');
  link.setAttribute('href', dataStr);
  link.setAttribute('download', 'cinemetrics_movie_analysis_export.json');
  document.body.appendChild(link);
  link.click();
  link.remove();

  showToast(`Exported ${state.filteredMovies.length} movies to JSON!`, 'file-json');
}

// Custom CSV Import Setup
function setupImportModal() {
  const btnImportModal = document.getElementById('btnImportCsvModal');
  const importModal = document.getElementById('importModal');
  const importModalCloseBtn = document.getElementById('importModalCloseBtn');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('csvFileInput');
  const btnConfirmImport = document.getElementById('btnConfirmImport');
  const btnSampleDataReset = document.getElementById('btnSampleDataReset');

  if (btnImportModal && importModal) {
    btnImportModal.addEventListener('click', () => importModal.classList.remove('hidden'));
  }
  if (importModalCloseBtn && importModal) {
    importModalCloseBtn.addEventListener('click', () => importModal.classList.add('hidden'));
    importModal.addEventListener('click', (e) => {
      if (e.target === importModal) importModal.classList.add('hidden');
    });
  }

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleCsvFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleCsvFile(e.target.files[0]);
      }
    });
  }

  function handleCsvFile(file) {
    if (!file.name.endsWith('.csv')) {
      showToast('Please upload a valid .csv file', 'alert-circle');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      parseCustomCsv(text);
    };
    reader.readAsText(file);
  }

  function parseCustomCsv(text) {
    try {
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        showToast('CSV is empty or missing data rows', 'alert-triangle');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      
      const parsedMovies = [];
      for (let i = 1; i < lines.length; i++) {
        // Simple regex to handle quoted commas
        const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
        if (cols.length < 3) continue;

        const cleanCols = cols.map(c => c.trim().replace(/^"(.*)"$/, '$1'));
        
        const titleIdx = headers.findIndex(h => h.includes('title') || h.includes('name'));
        const yearIdx = headers.findIndex(h => h.includes('year') || h.includes('date'));
        const genreIdx = headers.findIndex(h => h.includes('genre'));
        const directorIdx = headers.findIndex(h => h.includes('director'));
        const ratingIdx = headers.findIndex(h => h.includes('rating') || h.includes('imdb') || h.includes('score'));
        const budgetIdx = headers.findIndex(h => h.includes('budget') || h.includes('cost'));
        const revIdx = headers.findIndex(h => h.includes('revenue') || h.includes('gross') || h.includes('box'));

        const title = titleIdx !== -1 ? cleanCols[titleIdx] : `Film #${i}`;
        const year = yearIdx !== -1 ? parseInt(cleanCols[yearIdx]) || 2020 : 2020;
        const genres = genreIdx !== -1 ? cleanCols[genreIdx].split(/[|;,]/).map(g => g.trim()) : ['Drama'];
        const director = directorIdx !== -1 ? cleanCols[directorIdx] : 'Unknown';
        const rating = ratingIdx !== -1 ? parseFloat(cleanCols[ratingIdx]) || 7.0 : 7.0;
        const budget = budgetIdx !== -1 ? parseFloat(cleanCols[budgetIdx].replace(/[^0-9.]/g, '')) || 20_000_000 : 20_000_000;
        const revenue = revIdx !== -1 ? parseFloat(cleanCols[revIdx].replace(/[^0-9.]/g, '')) || 60_000_000 : 60_000_000;

        parsedMovies.push({
          id: 1000 + i,
          title,
          year,
          genres,
          director,
          cast: ['Ensemble Cast'],
          rating,
          metascore: Math.round(rating * 10),
          budget,
          revenue,
          profit: revenue - budget,
          roi: budget > 0 ? Number((((revenue - budget) / budget) * 100).toFixed(2)) : 0,
          runtime: 115,
          country: 'USA',
          synopsis: `Custom imported record for ${title}.`,
          poster: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=300&q=80'
        });
      }

      if (parsedMovies.length > 0) {
        state.uploadedData = parsedMovies;
        if (btnConfirmImport) {
          btnConfirmImport.disabled = false;
          btnConfirmImport.textContent = `Load ${parsedMovies.length} Custom Movies`;
        }
        showToast(`Parsed ${parsedMovies.length} films successfully! Click Load to view.`, 'check-circle');
      }
    } catch (err) {
      console.error(err);
      showToast('Error parsing CSV format. Please verify columns.', 'alert-triangle');
    }
  }

  if (btnConfirmImport) {
    btnConfirmImport.addEventListener('click', () => {
      if (state.uploadedData && state.uploadedData.length > 0) {
        state.allMovies = state.uploadedData;
        state.filteredMovies = [...state.allMovies];
        importModal.classList.add('hidden');
        applyFiltersAndRender();
        showToast(`Successfully activated ${state.allMovies.length} custom movie records!`, 'sparkles');
        if (typeof confetti === 'function') confetti({ particleCount: 80, spread: 80, origin: { y: 0.5 } });
      }
    });
  }

  if (btnSampleDataReset) {
    btnSampleDataReset.addEventListener('click', () => {
      if (typeof MOVIES_DATABASE !== 'undefined') {
        state.allMovies = JSON.parse(JSON.stringify(MOVIES_DATABASE));
        state.filteredMovies = [...state.allMovies];
        importModal.classList.add('hidden');
        applyFiltersAndRender();
        showToast('Restored standard 72 Blockbuster dataset', 'rotate-ccw');
      }
    });
  }
}
