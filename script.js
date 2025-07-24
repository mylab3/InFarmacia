document.addEventListener('DOMContentLoaded', () => {
    const pages = document.querySelectorAll('.page');
    const menuItems = document.querySelectorAll('.menu-item');
    const menuBtn = document.getElementById('menu-btn');
    const sideMenu = document.getElementById('side-menu');

    // Gestione Menu
    menuBtn.addEventListener('click', () => {
        sideMenu.style.width = sideMenu.style.width === '250px' ? '0' : '250px';
    });

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = item.getAttribute('data-page');
            pages.forEach(page => {
                page.classList.remove('active');
            });
            document.getElementById(pageId).classList.add('active');
            sideMenu.style.width = '0';
        });
    });

    // Inizializzazione dati
    let users = JSON.parse(localStorage.getItem('users')) || [];

    // Pagina Impostazioni
    const addUserForm = document.getElementById('add-user-form');
    const userList = document.getElementById('user-list');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');

    addUserForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newUser = {
            id: Date.now(),
            nome: document.getElementById('nome').value,
            cognome: document.getElementById('cognome').value,
            codiceFiscale: document.getElementById('codice-fiscale').value,
            foto: '', // La gestione della foto richiede un backend o FileReader
            nre: []
        };
        users.push(newUser);
        saveAndRender();
        addUserForm.reset();
    });

    function renderUsers() {
        userList.innerHTML = '';
        users.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-card';
            userDiv.innerHTML = `
                <p>${user.nome} ${user.cognome} - ${user.codiceFiscale}</p>
                <button onclick="deleteUser(${user.id})">Elimina</button>
            `;
            userList.appendChild(userDiv);
        });
        updateUserSelects();
    }

    window.deleteUser = function(id) {
        users = users.filter(user => user.id !== id);
        saveAndRender();
    }

    // Pagina Promemoria
    const selectUserPromemoria = document.getElementById('select-user-promemoria');
    const addNreForm = document.getElementById('add-nre-form');
    const nreInput = document.getElementById('nre');
    const nreList = document.getElementById('nre-list');

    selectUserPromemoria.addEventListener('change', renderNreList);

    addNreForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const selectedUserId = parseInt(selectUserPromemoria.value);
        const user = users.find(u => u.id === selectedUserId);
        if (user) {
            const nreString = nreInput.value.replace(/\s/g, '');
            if (nreString.length === 15) {
                user.nre.push({
                    code: nreString,
                    date: new Date().toLocaleDateString('it-IT'),
                    suspended: false
                });
                saveAndRender();
                nreInput.value = '';
            } else {
                alert('L\'NRE deve contenere 15 caratteri.');
            }
        }
    });

    function renderNreList() {
        const selectedUserId = parseInt(selectUserPromemoria.value);
        const user = users.find(u => u.id === selectedUserId);
        nreList.innerHTML = '';
        if (user && user.nre) {
            user.nre.forEach((nre, index) => {
                const nreDiv = document.createElement('div');
                nreDiv.className = 'nre-item';
                nreDiv.innerHTML = `
                    <span>${nre.date} - ${nre.code}</span>
                    <button onclick="toggleSuspendNre(${user.id}, ${index})">${nre.suspended ? 'Riattiva' : 'Sospendi'}</button>
                    <button onclick="deleteNre(${user.id}, ${index})">Cancella</button>
                `;
                nreList.appendChild(nreDiv);
            });
        }
    }

    window.toggleSuspendNre = function(userId, nreIndex) {
        const user = users.find(u => u.id === userId);
        if (user) {
            user.nre[nreIndex].suspended = !user.nre[nreIndex].suspended;
            saveAndRender();
        }
    }

    window.deleteNre = function(userId, nreIndex) {
        const user = users.find(u => u.id === userId);
        if (user) {
            user.nre.splice(nreIndex, 1);
            saveAndRender();
        }
    }


    // Pagina In Farmacia
    const selectUserFarmacia = document.getElementById('select-user-farmacia');
    const assistitoInfo = document.getElementById('assistito-info');
    const ricetteContainer = document.getElementById('ricette-container');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    let currentRicettaIndex = 0;
    let activeRicette = [];

    selectUserFarmacia.addEventListener('change', renderFarmaciaPage);

    function renderFarmaciaPage() {
        const selectedUserId = parseInt(selectUserFarmacia.value);
        const user = users.find(u => u.id === selectedUserId);
        assistitoInfo.innerHTML = '';
        ricetteContainer.innerHTML = '';
        if (user) {
            assistitoInfo.innerHTML = `
                <img src="${user.foto || 'https://via.placeholder.com/100'}" alt="Foto Assistito">
                <p><strong>Cognome:</strong> ${user.cognome}</p>
                <p><strong>Nome:</strong> ${user.nome}</p>
                <svg id="codice-fiscale-barcode" class="barcode"></svg>
            `;
            JsBarcode("#codice-fiscale-barcode", user.codiceFiscale, { format: "CODE39" });

            activeRicette = user.nre.filter(nre => !nre.suspended);
            currentRicettaIndex = 0;
            renderRicetta();
            updateNavButtons();
            
            // Mantiene lo schermo attivo
            if ('wakeLock' in navigator) {
                navigator.wakeLock.request('screen');
            }
        }
    }
    
    function renderRicetta() {
        ricetteContainer.innerHTML = '';
        if (activeRicette.length > 0) {
            const ricetta = activeRicette[currentRicettaIndex];
            ricetteContainer.innerHTML = `
                <p>${activeRicette.length} ricette da riscattare</p>
                <p>Ricetta n° ${currentRicettaIndex + 1}</p>
                <svg id="nre-barcode-1" class="barcode"></svg>
                <svg id="nre-barcode-2" class="barcode"></svg>
            `;
            JsBarcode("#nre-barcode-1", ricetta.code.substring(0, 5), { format: "CODE39" });
            JsBarcode("#nre-barcode-2", ricetta.code.substring(5), { format: "CODE39" });
        } else {
            ricetteContainer.innerHTML = '<p>Nessuna ricetta da riscattare.</p>';
        }
    }

    prevBtn.addEventListener('click', () => {
        if (currentRicettaIndex > 0) {
            currentRicettaIndex--;
            renderRicetta();
            updateNavButtons();
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentRicettaIndex < activeRicette.length - 1) {
            currentRicettaIndex++;
            renderRicetta();
            updateNavButtons();
        }
    });

    function updateNavButtons() {
        prevBtn.disabled = currentRicettaIndex === 0;
        nextBtn.disabled = currentRicettaIndex >= activeRicette.length - 1;
    }

    // Funzioni Utili
    function saveAndRender() {
        localStorage.setItem('users', JSON.stringify(users));
        renderUsers();
        renderNreList();
        renderFarmaciaPage();
    }

    function updateUserSelects() {
        selectUserPromemoria.innerHTML = '';
        selectUserFarmacia.innerHTML = '';
        users.forEach(user => {
            const option = `<option value="${user.id}">${user.nome} ${user.cognome}</option>`;
            selectUserPromemoria.innerHTML += option;
            selectUserFarmacia.innerHTML += option;
        });
    }

    // Backup
    exportBtn.addEventListener('click', () => {
        const dataStr = JSON.stringify(users);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = 'promemoria_assistito_backup.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    });

    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedUsers = JSON.parse(e.target.result);
                    if (Array.isArray(importedUsers)) {
                        users = importedUsers;
                        saveAndRender();
                        alert('Backup importato con successo!');
                    } else {
                        alert('File di backup non valido.');
                    }
                } catch (err) {
                    alert('Errore nel parsing del file di backup.');
                }
            };
            reader.readAsText(file);
        }
    });
    
    // Inizializzazione al caricamento della pagina
    saveAndRender();
});