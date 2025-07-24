document.addEventListener('DOMContentLoaded', () => {
    // ---- ELEMENTI DOM ----
    const pages = document.querySelectorAll('.page');
    const menuItems = document.querySelectorAll('.menu-item');
    const menuBtn = document.getElementById('menu-btn');
    const sideMenu = document.getElementById('side-menu');

    // Impostazioni
    const addUserForm = document.getElementById('add-user-form');
    const userList = document.getElementById('user-list');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    
    // Promemoria
    const selectUserPromemoria = document.getElementById('select-user-promemoria');
    const addNreForm = document.getElementById('add-nre-form');
    const nreInput = document.getElementById('nre');
    const nreList = document.getElementById('nre-list');
    
    // In Farmacia
    const selectUserFarmacia = document.getElementById('select-user-farmacia');
    const assistitoInfo = document.getElementById('assistito-info');
    const ricetteContainer = document.getElementById('ricette-container');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    // ---- STATO APPLICAZIONE ----
    let users = JSON.parse(localStorage.getItem('promemoria_assistito_users')) || [];
    let currentRicettaIndex = 0;
    let activeRicette = [];
    let wakeLock = null;

    // ---- GESTIONE MENU E PAGINE ----
    menuBtn.addEventListener('click', () => {
        sideMenu.style.width = sideMenu.style.width === '250px' ? '0' : '250px';
    });

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = item.getAttribute('data-page');
            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(pageId).classList.add('active');
            sideMenu.style.width = '0';
            
            if (pageId === 'in-farmacia') {
                requestWakeLock();
            } else {
                releaseWakeLock();
            }
        });
    });

    // ---- PAGINA IMPOSTAZIONI ----
    addUserForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newUser = {
            id: Date.now(),
            nome: document.getElementById('nome').value.toUpperCase(),
            cognome: document.getElementById('cognome').value.toUpperCase(),
            codiceFiscale: document.getElementById('codice-fiscale').value.toUpperCase(),
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
                <button class="btn-red" onclick="deleteUser(${user.id})">Elimina</button>
            `;
            userList.appendChild(userDiv);
        });
        updateUserSelects();
    }

    window.deleteUser = function(id) {
        if (confirm('Sei sicuro di voler eliminare questo assistito e tutte le sue ricette?')) {
            users = users.filter(user => user.id !== id);
            saveAndRender();
        }
    }

    // ---- PAGINA PROMEMORIA ----
    selectUserPromemoria.addEventListener('change', renderNreList);

    addNreForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const selectedUserId = parseInt(selectUserPromemoria.value);
        const user = users.find(u => u.id === selectedUserId);
        if (user) {
            const nreString = nreInput.value.replace(/\s/g, '').toUpperCase();
            if (nreString.length === 15) {
                user.nre.push({
                    code: nreString,
                    date: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit'}),
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
                    <span>${nre.date} - ${nre.suspended ? 'SOSPESA' : nre.code}</span>
                    <div>
                        <button class="btn-yellow" onclick="toggleSuspendNre(${user.id}, ${index})">${nre.suspended ? 'Riattiva' : 'Sospendi'}</button>
                        <button class="btn-red" onclick="deleteNre(${user.id}, ${index})">Cancella</button>
                    </div>
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
        if (confirm('Sei sicuro di voler eliminare questa ricetta?')) {
            const user = users.find(u => u.id === userId);
            if (user) {
                user.nre.splice(nreIndex, 1);
                saveAndRender();
            }
        }
    }

    // ---- PAGINA IN FARMACIA ----
    selectUserFarmacia.addEventListener('change', renderFarmaciaPage);

    function renderFarmaciaPage() {
        const selectedUserId = parseInt(selectUserFarmacia.value);
        const user = users.find(u => u.id === selectedUserId);
        assistitoInfo.innerHTML = '';
        ricetteContainer.innerHTML = '';
        prevBtn.style.backgroundColor = ''; // Reset color
        nextBtn.style.backgroundColor = ''; // Reset color

        if (user) {
            assistitoInfo.innerHTML = `
                <div class="assistito-name">${user.cognome} ${user.nome}</div>
                <div class="barcode-container">
                    <svg id="codice-fiscale-barcode" class="barcode"></svg>
                </div>
            `;
            try {
                JsBarcode("#codice-fiscale-barcode", user.codiceFiscale, { format: "CODE39", height: 40, displayValue: true });
            } catch (e) {
                console.error("Errore generazione barcode CF:", e);
            }

            activeRicette = user.nre.filter(nre => !nre.suspended);
            currentRicettaIndex = 0;
            renderRicetta();
            updateNavButtons();
        } else {
             assistitoInfo.innerHTML = '<p>Nessun assistito selezionato.</p>';
             activeRicette = [];
             renderRicetta();
             updateNavButtons();
        }
    }
    
    function renderRicetta() {
        ricetteContainer.innerHTML = '';
        if (activeRicette.length > 0) {
            const ricetta = activeRicette[currentRicettaIndex];
            const ricettaCountText = activeRicette.length === 1 ? '1 ricetta da visualizzare' : `${activeRicette.length} ricette da visualizzare`;
            const ricettaIndexText = activeRicette.length === 1 ? 'Ricetta unica' : `Ricetta n° ${currentRicettaIndex + 1}`;

            ricetteContainer.innerHTML = `
                <p class="info-ricetta">${ricettaCountText}</p>
                <p class="info-ricetta">${ricettaIndexText}</p>
                <div class="barcode-container">
                    <svg id="nre-barcode-1" class="barcode"></svg>
                </div>
                <div class="barcode-container">
                    <svg id="nre-barcode-2" class="barcode"></svg>
                </div>
            `;
            try {
                JsBarcode("#nre-barcode-1", ricetta.code.substring(0, 5), { format: "CODE39", height: 60, displayValue: true });
                JsBarcode("#nre-barcode-2", ricetta.code.substring(5), { format: "CODE39", height: 60, displayValue: true });
            } catch (e) {
                 console.error("Errore generazione barcode NRE:", e);
            }
        } else {
            ricetteContainer.innerHTML = '<p class="info-ricetta">Nessuna ricetta da visualizzare.</p>';
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
        if (activeRicette.length <= 1) {
             prevBtn.disabled = true;
             nextBtn.disabled = true;
        } else {
            prevBtn.disabled = currentRicettaIndex === 0;
            nextBtn.disabled = currentRicettaIndex >= activeRicette.length - 1;
        }
    }

    // ---- FUNZIONI UTILI E BACKUP ----
    function saveAndRender() {
        localStorage.setItem('promemoria_assistito_users', JSON.stringify(users));
        renderUsers();
        if(document.getElementById('promemoria').classList.contains('active')) renderNreList();
        if(document.getElementById('in-farmacia').classList.contains('active')) renderFarmaciaPage();
    }

    function updateUserSelects() {
        const currentPromemoria = selectUserPromemoria.value;
        const currentFarmacia = selectUserFarmacia.value;
        selectUserPromemoria.innerHTML = '<option value="">---</option>';
        selectUserFarmacia.innerHTML = '<option value="">---</option>';
        users.forEach(user => {
            const option = `<option value="${user.id}">${user.nome} ${user.cognome}</option>`;
            selectUserPromemoria.innerHTML += option;
            selectUserFarmacia.innerHTML += option;
        });
        selectUserPromemoria.value = currentPromemoria;
        selectUserFarmacia.value = currentFarmacia;
    }

    exportBtn.addEventListener('click', () => {
        if (users.length === 0) {
            alert('Nessun dato da esportare.');
            return;
        }
        const dataStr = JSON.stringify(users, null, 2);
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
                        if (confirm('Importando un nuovo file, tutti i dati attuali verranno sovrascritti. Continuare?')) {
                            users = importedUsers;
                            saveAndRender();
                            alert('Backup importato con successo!');
                        }
                    } else { throw new Error('Formato non valido'); }
                } catch (err) {
                    alert('Errore: Il file di backup non è valido o è corrotto.');
                } finally {
                    importFile.value = ''; // Resetta l'input file
                }
            };
            reader.readAsText(file);
        }
    });
    
    // ---- SCREEN WAKE LOCK API ----
    const requestWakeLock = async () => {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
            } catch (err) {
                console.log(`${err.name}, ${err.message}`);
            }
        }
    };
    const releaseWakeLock = async () => {
        if (wakeLock !== null) {
            await wakeLock.release();
            wakeLock = null;
        }
    };

    // ---- INIZIALIZZAZIONE ----
    updateUserSelects();
    renderFarmaciaPage();
    requestWakeLock();
});