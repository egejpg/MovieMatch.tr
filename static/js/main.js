let selectedMovie = null;
    let currentUser = null;
    let selectedMovies = {};
    let searchTimeout = null;
    let currentSearchRequest = null;

    // Modal açıldığında user bilgisini al
    const movieSearchModal = document.getElementById('movieSearchModal');
    movieSearchModal.addEventListener('show.bs.modal', function (event) {
        const button = event.relatedTarget;
        currentUser = button.getAttribute('data-user');
        const modalTitle = document.getElementById('modalUserTitle');
        
        if (currentUser === 'user1') {
            modalTitle.textContent = 'Seninle Başla - Film Seç';
        } else {
            modalTitle.textContent = 'Arkadaşla Devam Et - Film Seç';
        }
        
        // Reset
        selectedMovie = null;
        document.getElementById('movieSearchInput').value = '';
        document.getElementById('searchResultsContainer').innerHTML = '<p class="text-center text-white">Film aramak için yazınız...</p>';
        document.getElementById('selectedMovieDisplay').innerHTML = '<span class="text-secondary">Henüz film seçilmedi</span>';
        document.getElementById('confirmMovieBtn').disabled = true;
    });

    // Arama input event listener - Debounce ile
    document.getElementById('movieSearchInput').addEventListener('input', function(e) {
        const query = e.target.value.trim();
        
        // Önceki timeout'u iptal et
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        if (query.length < 2) {
            document.getElementById('searchResultsContainer').innerHTML = '<p class="text-center text-white">Film aramak için yazınız...</p>';
            return;
        }

        // 300ms sonra ara debounce
        searchTimeout = setTimeout(function() {
            searchMovies(query);
        }, 300);
    });

    function searchMovies(query) {
        // Önceki isteği iptal et AbortController
        if (currentSearchRequest) {
            currentSearchRequest.abort();
        }
        
        currentSearchRequest = new AbortController();
        
        // Backend API'ye istek gönder
        document.getElementById('searchResultsContainer').innerHTML = '<div class="text-center"><span class="spinner-border spinner-border-sm text-danger me-2"></span><span class="text-white">Aranıyor...</span></div>';
        
        fetch('/api/search-movie', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: query }),
            signal: currentSearchRequest.signal
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                document.getElementById('searchResultsContainer').innerHTML = '<p class="text-center text-danger">' + data.error + '</p>';
                return;
            }

            const movies = data.results || [];
            
            if (movies.length === 0) {
                document.getElementById('searchResultsContainer').innerHTML = '<p class="text-center text-white">Film bulunamadı</p>';
                return;
            }

            let html = '<div class="list-group">';
            movies.forEach(movie => {
                html += `
                    <button type="button" class="list-group-item list-group-item-action movie-result" 
                            style="background-color: #2a2a2a; border-color: #333; color: #ffffff;"
                            data-movie-id="${movie.id}" data-movie-title="${movie.title}" data-movie-year="${movie.year}" data-movie-backdrop="${movie.backdrop_path || ''}">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-1">${movie.title}</h6>
                                <small class="text-light">${movie.year}</small>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <span class="d-flex align-items-center">
                                    <i class="fas fa-star" style="color: #ffc107; margin-right: 0.25rem;"></i>
                                    <span class="text-warning fw-bold">${movie.rating}</span>
                                </span>
                                <i class="fas fa-plus text-danger"></i>
                            </div>
                        </div>
                    </button>
                `;
            });
            html += '</div>';

            document.getElementById('searchResultsContainer').innerHTML = html;
            attachMovieClickHandlers();
            currentSearchRequest = null;
        })
        .catch(error => {
            if (error.name === 'AbortError') {
                console.log('Previous search cancelled');
                return;
            }
            console.error('Search error:', error);
            document.getElementById('searchResultsContainer').innerHTML = '<p class="text-center text-danger">Bir hata oluştu. Lütfen tekrar deneyin.</p>';
            currentSearchRequest = null;
        });
    }

    function attachMovieClickHandlers() {
        // Film seçme olayları
        document.querySelectorAll('.movie-result').forEach(item => {
            item.addEventListener('click', function() {
                selectedMovie = {
                    id: this.getAttribute('data-movie-id'),
                    title: this.getAttribute('data-movie-title'),
                    year: this.getAttribute('data-movie-year'),
                    backdrop_path: this.getAttribute('data-movie-backdrop')
                };

                // Seçilen filmi göster
                const selectedDisplay = document.getElementById('selectedMovieDisplay');
                selectedDisplay.innerHTML = `
                    <div class="d-flex align-items-center">
                        <i class="fas fa-film me-3" style="color: #dc3545; font-size: 1.5rem;"></i>
                        <span class="text-white"></span>
                    </div>
                `;
                selectedDisplay.querySelector('span').textContent = `${selectedMovie.title} (${selectedMovie.year})`;

                // Confirm butonunu aktifleştir
                document.getElementById('confirmMovieBtn').disabled = false;

                document.querySelectorAll('.movie-result').forEach(el => {
                    el.style.borderColor = '#333';
                    el.style.borderLeftColor = '#333';
                });
                this.style.borderColor = '#dc3545';
                this.style.borderLeftColor = '#dc3545';
            });
        });
    }

    // Filmi onayla
    document.getElementById('confirmMovieBtn').addEventListener('click', function() {
        if (selectedMovie && currentUser) {
            // Backend'e filmini kaydet
            fetch('/api/select-movie', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user: currentUser,
                    movie: selectedMovie
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Local olarak da kaydet
                    selectedMovies[currentUser] = selectedMovie;
                    console.log(`${currentUser}: ${selectedMovie.title} kaydedildi`);
                    
                    // Modal'ı kapat
                    const modal = bootstrap.Modal.getInstance(movieSearchModal);
                    modal.hide();
                    
                    // UI'da seçilen filmi göster
                    updateSelectedMoviesUI();
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Film kaydı sırasında hata oluştu');
            });
        }
    });

    function updateSelectedMoviesUI() {
        // user1 kartını güncelle
        if (selectedMovies.user1) {
            const user1Card = document.querySelector('[data-user="user1"]');
            if (user1Card) {
                const cardContainer = user1Card.querySelector('.card-img-container');
                const cardContent = cardContainer.querySelector('div');
                
                // Backdrop URL
                if (selectedMovies.user1.backdrop_path) {
                    const backdropUrl = `https://image.tmdb.org/t/p/w780${selectedMovies.user1.backdrop_path}`;
                    cardContainer.style.backgroundImage = `url('${backdropUrl}')`;
                    cardContainer.style.backgroundSize = 'cover';
                    cardContainer.style.backgroundPosition = 'center';
                    cardContainer.style.backgroundRepeat = 'no-repeat';
                    
                    // İçeriğe yarı saydam siyah arka plan ekle
                    cardContent.style.background = 'rgba(0, 0, 0, 0.2)';
                }
                
                user1Card.querySelector('.card-title').textContent = selectedMovies.user1.title;
            }
        }
        
        // user2 kartını güncelle
        if (selectedMovies.user2) {
            const user2Card = document.querySelector('[data-user="user2"]');
            if (user2Card) {
                const cardContainer = user2Card.querySelector('.card-img-container');
                const cardContent = cardContainer.querySelector('div');
                
                // Backdrop URL
                if (selectedMovies.user2.backdrop_path) {
                    const backdropUrl = `https://image.tmdb.org/t/p/w780${selectedMovies.user2.backdrop_path}`;
                    cardContainer.style.backgroundImage = `url('${backdropUrl}')`;
                    cardContainer.style.backgroundSize = 'cover';
                    cardContainer.style.backgroundPosition = 'center';
                    cardContainer.style.backgroundRepeat = 'no-repeat';
                    
                    // İçeriğe yarı saydam siyah arka plan ekle
                    cardContent.style.background = 'rgba(0, 0, 0, 0.5)';
                }
                
                user2Card.querySelector('.card-title').textContent = selectedMovies.user2.title;
            }
        }
    }

    // Shuffle Butonu
    document.getElementById('shuffleBtn').addEventListener('click', function() {
        if (!selectedMovies.user1 || !selectedMovies.user2) {
            alert('Lütfen her iki kullanıcının da film seçmesini sağlayın');
            return;
        }
        
        // Loading state
        const shuffleBtn = document.getElementById('shuffleBtn');
        const cardContainer = shuffleBtn.querySelector('.card-img-container');
        const originalContent = cardContainer.innerHTML;
        
        cardContainer.innerHTML = '<div class="d-flex align-items-center justify-content-center h-100"><span class="spinner-border spinner-border-sm text-white me-2"></span><span class="text-white">Eşleştiriliyor...</span></div>';
        shuffleBtn.disabled = true;
        
        // Gemini API'ye istek gönder
        fetch('/api/find-match', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 3. kartı sonuç göster
                displayResult(data.recommended_movie, data.reason, data.backdrop_path);
                shuffleBtn.disabled = false;
            } else {
                alert('Hata: ' + (data.error || 'Bilinmeyen hata'));
                cardContainer.innerHTML = originalContent;
                shuffleBtn.disabled = false;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Bir hata oluştu: ' + error.message);
            cardContainer.innerHTML = originalContent;
            shuffleBtn.disabled = false;
        });
    });

    function displayResult(movieTitle, reason, backdropPath) {
        const shuffleBtn = document.getElementById('shuffleBtn');
        
        // Kartın içeriğini güncelle
        const cardContainer = shuffleBtn.querySelector('.card-img-container');
        
        if (!cardContainer) {
            console.error('Card container not found');
            alert('Sonuç gösterilirken hata oluştu');
            return;
        }
        
        // Eski içeriği tut
        const originalHTML = cardContainer.innerHTML;
        
        // Backdrop URL- Önerilen filmin backdrop'ini kullan, yoksa fallback
        const backdropUrl = backdropPath
            ? `https://image.tmdb.org/t/p/w780${backdropPath}`
            : (selectedMovies.user2?.backdrop_path 
                ? `https://image.tmdb.org/t/p/w780${selectedMovies.user2.backdrop_path}`
                : (selectedMovies.user1?.backdrop_path 
                    ? `https://image.tmdb.org/t/p/w780${selectedMovies.user1.backdrop_path}`
                    : 'https://via.placeholder.com/1280x720?text=Film'));
        
        // Yeni içeriği oluştur
        cardContainer.style.backgroundImage = `url('${backdropUrl}')`;
        cardContainer.style.backgroundSize = 'cover';
        cardContainer.style.backgroundPosition = 'center';
        cardContainer.style.backgroundRepeat = 'no-repeat';
        
        const resultHTML = `
            <div class="d-flex flex-column align-items-center justify-content-center h-100 text-center px-3 animate__animated animate__fadeIn" style="background: rgba(0,0,0,0.8); border-radius: 1rem;">
                <i class="fas fa-star fa-2x text-warning mb-3" style="animation: pulse 2s infinite;"></i>
                <h4 class="text-white mb-2" style="font-weight: bold;">${movieTitle}</h4>
                <p class="text-white-50 mb-3" style="font-size: 0.9rem; line-height: 1.4;">${reason}</p>
                <button class="btn btn-sm btn-light mt-2" onclick="window.resetResult()">
                    <i class="fas fa-redo me-1"></i>Tekrar Dene
                </button>
            </div>
        `;
        
        cardContainer.innerHTML = resultHTML;
        
        // Reset fonksiyonunu global yap
        window.resetResult = function() {
            cardContainer.style.backgroundImage = '';
            cardContainer.innerHTML = originalHTML;
        };
    }