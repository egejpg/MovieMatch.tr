let selectedMovie = null;
    let currentUser = null;
    let selectedMovies = {};

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

    // Arama input dinleyicisi
    document.getElementById('movieSearchInput').addEventListener('input', function(e) {
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            document.getElementById('searchResultsContainer').innerHTML = '<p class="text-center text-white">Film aramak için yazınız...</p>';
            return;
        }

        searchMovies(query);
    });

    function searchMovies(query) {
        // Backend API'ye istek gönder
        document.getElementById('searchResultsContainer').innerHTML = '<div class="text-center"><span class="spinner-border spinner-border-sm text-danger me-2"></span><span class="text-white">Aranıyor...</span></div>';
        
        fetch('/api/search-movie', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: query })
        })
        .then(response => response.json())
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
                            <i class="fas fa-plus text-danger"></i>
                        </div>
                    </button>
                `;
            });
            html += '</div>';

            document.getElementById('searchResultsContainer').innerHTML = html;
            attachMovieClickHandlers();
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('searchResultsContainer').innerHTML = '<p class="text-center text-danger">Bir hata oluştu. Lütfen tekrar deneyin.</p>';
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

                // Seçili öğeyi vurgula
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
                
                // Backdrop URL'si oluştur
                if (selectedMovies.user1.backdrop_path) {
                    const backdropUrl = `https://image.tmdb.org/t/p/w780${selectedMovies.user1.backdrop_path}`;
                    cardContainer.style.backgroundImage = `url('${backdropUrl}')`;
                    cardContainer.style.backgroundSize = 'cover';
                    cardContainer.style.backgroundPosition = 'center';
                    cardContainer.style.backgroundRepeat = 'no-repeat';
                    
                    // İçeriğe yarı saydam siyah arka plan ekle
                    cardContent.style.background = 'rgba(0, 0, 0, 0.5)';
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
                
                // Backdrop URL'si oluştur
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

    // Karıştır Butonu
    document.getElementById('shuffleBtn').addEventListener('click', function() {
        if (!selectedMovies.user1 || !selectedMovies.user2) {
            alert('Lütfen her iki kullanıcının da film seçmesini sağlayın');
            return;
        }
        
        // Loading state
        const shuffleBtn = document.getElementById('shuffleBtn');
        const originalContent = shuffleBtn.innerHTML;
        shuffleBtn.innerHTML = '<div class="d-flex align-items-center justify-content-center h-100"><span class="spinner-border spinner-border-sm text-white me-2"></span><span class="text-white">Eşleştiriliyor...</span></div>';
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
                displayResult(data.recommended_movie, data.reason);
                shuffleBtn.innerHTML = originalContent;
                shuffleBtn.disabled = false;
            } else {
                alert('Hata: ' + (data.error || 'Bilinmeyen hata'));
                shuffleBtn.innerHTML = originalContent;
                shuffleBtn.disabled = false;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Bir hata oluştu');
            shuffleBtn.innerHTML = originalContent;
            shuffleBtn.disabled = false;
        });
    });

    function displayResult(movieTitle, reason) {
        const shuffleBtn = document.getElementById('shuffleBtn');
        const selectedMovies_data = session.get('selected_movies', {});
        
        // Kartın içeriğini güncelle
        const cardContainer = shuffleBtn.querySelector('.card-img-container');
        
        // Eski içeriği saklı tut
        const originalHTML = cardContainer.innerHTML;
        
        // Backdrop URL'si oluştur
        const backdropUrl = selectedMovies.user1?.backdrop_path 
            ? `https://image.tmdb.org/t/p/w780${selectedMovies.user1.backdrop_path}`
            : 'https://via.placeholder.com/1280x720?text=No+Image';
        
        // Yeni içeriği oluştur
        cardContainer.style.backgroundImage = `url('${backdropUrl}')`;
        cardContainer.style.backgroundSize = 'cover';
        cardContainer.style.backgroundPosition = 'center';
        
        cardContainer.innerHTML = `
            <div class="d-flex flex-column align-items-center justify-content-center h-100 text-center px-3 animate__animated animate__fadeIn" style="background: rgba(0,0,0,0.7);">
                <i class="fas fa-star fa-2x text-warning mb-3" style="animation: pulse 2s infinite;"></i>
                <h4 class="text-white mb-2">${movieTitle}</h4>
                <p class="text-white-50 small mb-3" style="font-size: 0.85rem;">${reason}</p>
                <button class="btn btn-sm btn-light mt-2" onclick="resetResult()">
                    <i class="fas fa-redo me-1"></i>Tekrar Dene
                </button>
            </div>
        `;
        
        // Reset fonksiyonunu global yap
        window.resetResult = function() {
            cardContainer.style.backgroundImage = '';
            cardContainer.innerHTML = originalHTML;
        };
    }