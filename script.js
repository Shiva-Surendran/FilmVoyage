const svg = d3.select("#world-map");   //selects svg element
const width = window.innerWidth;
const height = window.innerHeight;

const TMDB_API_KEY = "6b7129f4d471a63cf0ff328b9df89dc1";

let tmdbCountries = [];
let selectedCountryISO = null;
let currentPage = 1;
let totalPages = 1;


//************************************************************************************************************************//

fetch(`https://api.themoviedb.org/3/configuration/countries?api_key=${TMDB_API_KEY}`)   //load iso code of countries
  .then(res => res.json())
  .then(data => {
    tmdbCountries = data;
    console.log("TMDB countries loaded", tmdbCountries);
  })
  .catch(err => console.error("TMDB country fetch failed", err));

function getISOCode(countryName) {            //country name to iso code
  if (!tmdbCountries.length) return null;

  const match = tmdbCountries.find(
    c => c.english_name === countryName
  );

  return match ? match.iso_3166_1 : null;
}

//************************************************************************************************************************//


let tmdbGenres = [];
let selectedGenreId = null;

fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_API_KEY}`)
  .then(res => res.json())
  .then(data => {
    tmdbGenres = data.genres;
    renderGenreButtons(tmdbGenres);
    console.log("TMDB genres loaded", tmdbGenres);
  })
  .catch(err => console.error("TMDB genre fetch failed", err));


//************************************************************************************************************************//

svg.attr("viewBox", `0 0 ${width} ${height}`); //viewbox defines how much space svg has

const projection = d3.geoNaturalEarth1()      //converts lang long data to xy coordinates
  .scale(width / 5.5)
  .translate([width / 2.2, height / 1.8]);

const path = d3.geoPath().projection(projection);     //convert xy coordinates to svg path instructions

d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
  .then(worldData => {
    const countries = topojson.feature(   //convert topjson compressed data to geojson
      worldData,
      worldData.objects.countries
    ).features;

    svg.selectAll("path")
      .data(countries)
      .enter()
      .append("path")
      .attr("class", "country")   //css
      .attr("d", path)     //draw

      .on("click", function (event, d) {
        svg.selectAll(".country").classed("selected", false);  //remove all countries, selected is css
        d3.select(this).classed("selected", true);   //only country selected 
        const countryName = d.properties.name;
        const isoCode = getISOCode(countryName);
        selectedCountryISO = isoCode;

        d3.select("#sidebar-country")
          .text(countryName);
        d3.select("#sidebar-meta")
          .text(isoCode ? `ISO Code: ${isoCode}` : "ISO Code not found"

          ); currentPage = 1;
        fetchMoviesForCountry(countryName);

      });
  });

//************************************************************************************************************************//

async function fetchMoviesForCountry(countryName) {
  if (!selectedCountryISO) {
    console.warn("No ISO code selected");
    return;
  }

 if (currentPage === 1) {
    showLoadingSkeleton();
  }

  let url =
    `https://api.themoviedb.org/3/discover/movie` +
    `?api_key=${TMDB_API_KEY}` +
    `&with_origin_country=${selectedCountryISO}` +
    `&sort_by=vote_average.desc` +
    `&vote_count.gte=220`+   
     `&page=${currentPage}`;
;

  url += `&page=${currentPage}`;

  if (selectedGenreId) {
    url += `&with_genres=${selectedGenreId}`;
  }

  try {
    const res = await fetch(url);
    const data = await res.json();
    totalPages = data.total_pages;


    const loadMoreBtn = document.getElementById("load-more");
    if (loadMoreBtn) {
      // Hide button if no more pages, show it if there are
      if (currentPage >= totalPages || totalPages === 0) {
        loadMoreBtn.classList.add("hidden");
      } else {
        loadMoreBtn.classList.remove("hidden");
      }
    }

    updateSidebarWithMovies(countryName, data.results, currentPage === 1 );
  } catch (err) {
    console.error("TMDB movie fetch failed", err);
  }
}

//************************************************************************************************************************//


function updateSidebarWithMovies(countryName, movies, replace = false) {
  const list = document.getElementById("movie-list");

  if (replace) {
    list.innerHTML = "";
  }

  if (!movies || movies.length === 0) {
    if (replace) {
      list.innerHTML = `<div class="p-10 text-center opacity-50">No movies found.</div>`;
    }
    return;
  }

  list.insertAdjacentHTML(
    "beforeend",
    movies.map(movie => {
      const poster = movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : "";

      return `
        <div class="movie-card"> 
          <img src="${poster}" alt="${movie.title}" />
<div class="flex items-center gap-3 mt-2">
                </div>

          <div class="movie-info">
            <div class="movie-title">${movie.title}</div>
            <div class="movie-rating">⭐ ${movie.vote_average.toFixed(1)}</div>

             <span class="text-[15px] text-slate-500 font-bold uppercase tracking-tighter">${movie.release_date?.split('-')[0] || 'N/A'}</span>

          </div>
        </div>
      `;
    }).join("")
  );
}



//************************************************************************************************************************//

function renderGenreButtons(genres) {
  const container = document.getElementById("genre-filters");

  container.innerHTML = genres
    .map(genre => `
      <button 
        class="btn-genre px-3 py-1.5 border border-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all hover:border-primary text-slate-400" 
        data-genre-id="${genre.id}">
        ${genre.name}
      </button>
    `)
    .join("");

  d3.selectAll(".btn-genre").on("click", function () {
    const isAlreadyActive = d3.select(this).classed("active");

    // 1. Reset all buttons first
    d3.selectAll(".btn-genre").classed("active", false);

    if (isAlreadyActive) {
      // 2. If it was already active, "unclick" it by keeping selectedGenreId null
      selectedGenreId = null;
    } else {
      // 3. Otherwise, set the new genre and make it look active
      d3.select(this).classed("active", true);
      selectedGenreId = this.dataset.genreId;
    }

    // 4. Re-fetch movies (this will now respect the null/new genre)
    if (selectedCountryISO) {
      currentPage = 1;
      fetchMoviesForCountry(d3.select("#sidebar-country").text());
    }
  });

}
//************************************************************************************************************************//

function showLoadingSkeleton() {
  const list = document.getElementById("movie-list");

  list.innerHTML = Array.from({ length: 6 })
    .map(() => `
      <div class="skeleton">
        <div class="skeleton-poster"></div>
        <div class="skeleton-lines">
          <div class="skeleton-line"></div>
          <div class="skeleton-line" style="width:60%"></div>
        </div>
      </div>
    `)
    .join("");
}
document.getElementById("load-more").addEventListener("click", () => {
  if (currentPage < totalPages) {
    currentPage++;
    fetchMoviesForCountry(
      d3.select("#sidebar-country").text()
    );
  }
});
