// static/app.js
document.addEventListener('DOMContentLoaded', () => {
    const viewContent = document.getElementById('view-content');
    const navItems = document.querySelectorAll('.nav-item');
    const loadingOverlay = document.getElementById('loading');

    let currentView = null; // Almacena la vista HTML cargada
    let cropper = null; // Instancia global de Cropper.js
    let capturedBlob = null; // Blob de la imagen capturada o recortada

    // --- Funciones de Utilidad ---
    function showLoading() { loadingOverlay.classList.remove('hidden'); }
    function hideLoading() { loadingOverlay.classList.add('hidden'); }

    // Carga los PDFs guardados de localStorage
    function getSavedPdfs() {
        const pdfs = localStorage.getItem('myPdfs');
        return pdfs ? JSON.parse(pdfs) : [];
    }

    // Guarda los PDFs en localStorage
    function savePdfs(pdfs) {
        localStorage.setItem('myPdfs', JSON.stringify(pdfs));
    }

    // Añade un nuevo PDF a localStorage
    function addPdf(name, dataUrl) {
        const pdfs = getSavedPdfs();
        const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        pdfs.push({ id: Date.now(), name: name, date: date, dataUrl: dataUrl });
        savePdfs(pdfs);
        // Si estamos en la vista de PDFs, la actualizamos
        if (currentView && currentView.dataset.viewName === 'my_pdfs') {
            loadView('my_pdfs');
        }
    }

    // --- Carga de Vistas ---
    async function loadView(viewName, params = {}) {
        showLoading();
        try {
            const response = await fetch(`/static/views/${viewName}.html`);
            if (!response.ok) throw new Error(`Could not load view: ${viewName}`);
            const html = await response.text();
            
            viewContent.innerHTML = html;
            currentView = viewContent.firstElementChild; // Obtener la raíz del HTML cargado
            currentView.dataset.viewName = viewName; // Para identificar la vista actual
            
            // Re-inicializar eventos específicos de la vista
            initializeView(viewName, params);

            // Resaltar el botón de navegación activo
            navItems.forEach(item => {
                if (item.dataset.view === viewName) {
                    item.classList.add('text-cyan-500');
                    item.classList.remove('text-gray-600');
                } else {
                    item.classList.remove('text-cyan-500');
                    item.classList.add('text-gray-600');
                }
            });

        } catch (error) {
            console.error('Error al cargar la vista:', error);
            viewContent.innerHTML = `<p class="text-center text-red-500 p-4">Error al cargar la página: ${viewName}</p>`;
        } finally {
            hideLoading();
        }
    }

    // --- Inicialización de Eventos por Vista ---
    function initializeView(viewName, params) {
        if (cropper) {
            cropper.destroy(); // Limpiar cropper si existe de una vista anterior
            cropper = null;
        }

        switch (viewName) {
            case 'home':
                const convertBtn = viewContent.querySelector('#convert-image-btn');
                if (convertBtn) {
                    convertBtn.addEventListener('click', () => loadView('camera'));
                }
                break;
            case 'my_pdfs':
                const pdfListContainer = viewContent.querySelector('#pdf-list');
                const addPdfBtn = viewContent.querySelector('#add-pdf-btn'); // Botón flotante para añadir PDF

                if (pdfListContainer) {
                    const pdfs = getSavedPdfs();
                    if (pdfs.length === 0) {
                        pdfListContainer.innerHTML = '<p class="text-center text-gray-500 p-4">No tienes PDFs guardados aún.</p>';
                    } else {
                        pdfListContainer.innerHTML = pdfs.map(pdf => `
                            <div class="flex items-center justify-between p-3 border-b border-gray-200 last:border-b-0">
                                <div class="flex items-center gap-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0113 2.586L16.414 6A2 2 0 0117 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 10a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1-4a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd" />
                                    </svg>
                                    <div>
                                        <p class="font-medium text-gray-800">${pdf.name}</p>
                                        <p class="text-sm text-gray-500">Convertido el ${pdf.date}</p>
                                    </div>
                                </div>
                                <a href="${pdf.dataUrl}" download="${pdf.name}.pdf" class="text-cyan-600 hover:text-cyan-800 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                </a>
                            </div>
                        `).join('');
                    }
                }
                if (addPdfBtn) {
                    addPdfBtn.addEventListener('click', () => loadView('camera'));
                }
                break;
            case 'camera':
                const videoElement = viewContent.querySelector('#video');
                const captureButton = viewContent.querySelector('#capture-btn');
                const capturedImageElement = viewContent.querySelector('#captured-image');
                const cropButton = viewContent.querySelector('#crop-btn');
                const processButton = viewContent.querySelector('#process-btn');
                const backToCameraBtn = viewContent.querySelector('#back-to-camera-btn');
                const backToHomeBtn = viewContent.querySelector('#back-to-home-btn'); // Nuevo botón para volver a Inicio

                const cameraViewEl = viewContent.querySelector('#camera-capture-view');
                const editViewEl = viewContent.querySelector('#image-edit-view');

                const brightnessInput = viewContent.querySelector('#brightness');
                const contrastInput = viewContent.querySelector('#contrast');
                const sharpnessInput = viewContent.querySelector('#sharpness');
                const grayscaleCheckbox = viewContent.querySelector('#grayscale');

                let stream; // La referencia al stream de la cámara

                // Función para iniciar la cámara
                async function initCamera() {
                    cameraViewEl.classList.remove('hidden');
                    editViewEl.classList.add('hidden');
                    capturedImageElement.src = '';
                    capturedBlob = null;
                    if (cropper) {
                        cropper.destroy();
                        cropper = null;
                    }
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({
                            video: { facingMode: 'environment' } // Cámara trasera
                        });
                        videoElement.srcObject = stream;
                    } catch (err) {
                        console.error("Error al acceder a la cámara:", err);
                        alert("No se pudo acceder a la cámara. Asegúrate de dar permisos.");
                        loadView('home'); // Volver a inicio si no hay cámara
                    }
                }
                initCamera();

                // Detener la cámara al salir de la vista
                viewContent.addEventListener('DOMNodeRemoved', () => {
                    if (stream) {
                        stream.getTracks().forEach(track => track.stop());
                    }
                });

                // Capturar foto
                captureButton.addEventListener('click', () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = videoElement.videoWidth;
                    canvas.height = videoElement.videoHeight;
                    const context = canvas.getContext('2d');
                    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

                    canvas.toBlob(blob => {
                        capturedBlob = blob;
                        const imageUrl = URL.createObjectURL(blob);
                        capturedImageElement.src = imageUrl;

                        cameraViewEl.classList.add('hidden');
                        editViewEl.classList.remove('hidden');

                        if (stream) stream.getTracks().forEach(track => track.stop());

                        if (cropper) cropper.destroy();
                        cropper = new Cropper(capturedImageElement, {
                            viewMode: 1, autoCropArea: 0.9, background: false,
                        });
                        applyPreviewFilters(); // Aplica filtros iniciales
                    }, 'image/png');
                });

                // Aplicar filtros de vista previa (solo CSS)
                function applyPreviewFilters() {
                    const grayscaleValue = grayscaleCheckbox.checked ? 'grayscale(100%)' : 'grayscale(0%)';
                    const filterStyle = `
                        brightness(${brightnessInput.value}) 
                        contrast(${contrastInput.value}) 
                        ${grayscaleValue}
                    `;
                    const cropperCanvas = viewContent.querySelector('.cropper-canvas img');
                    if(cropperCanvas) {
                        cropperCanvas.style.filter = filterStyle;
                    }
                }
                brightnessInput.addEventListener('input', applyPreviewFilters);
                contrastInput.addEventListener('input', applyPreviewFilters);
                grayscaleCheckbox.addEventListener('input', applyPreviewFilters);

                // Aplicar recorte (actualiza la imagen en la vista de edición)
                cropButton.addEventListener('click', () => {
                    if (!cropper) return;
                    showLoading();
                    const croppedCanvas = cropper.getCroppedCanvas();
                    croppedCanvas.toBlob(blob => {
                        capturedBlob = blob;
                        const newUrl = URL.createObjectURL(blob);
                        cropper.destroy();
                        capturedImageElement.src = newUrl;
                        cropper = new Cropper(capturedImageElement, { viewMode: 1, autoCropArea: 1, background: false });
                        setTimeout(applyPreviewFilters, 100);
                        hideLoading();
                        alert("Recorte aplicado.");
                    }, 'image/png');
                });

                // Procesar y generar PDF
                processButton.addEventListener('click', async () => {
                    if (!capturedBlob && !cropper) {
                        alert("Primero debes capturar o recortar una foto.");
                        return;
                    }
                    showLoading();

                    let imageToSend = capturedBlob;
                    if (cropper && !capturedBlob) {
                        imageToSend = await new Promise(resolve => {
                            cropper.getCroppedCanvas().toBlob(resolve, 'image/png');
                        });
                    }
                    
                    const formData = new FormData();
                    formData.append('image', imageToSend, 'scan.png');
                    formData.append('brightness', brightnessInput.value);
                    formData.append('contrast', contrastInput.value);
                    formData.append('sharpness', sharpnessInput.value);
                    formData.append('grayscale', grayscaleCheckbox.checked);

                    try {
                        const response = await fetch('/process-image', {
                            method: 'POST',
                            body: formData
                        });

                        if (!response.ok) {
                            throw new Error('Error en el servidor: ' + response.statusText);
                        }

                        const pdfBlob = await response.blob();
                        const reader = new FileReader();
                        reader.onloadend = function() {
                            const base64data = reader.result;
                            const pdfName = prompt("Introduce un nombre para tu PDF:", `Documento ${new Date().toLocaleDateString()}`);
                            if (pdfName) {
                                addPdf(pdfName, base64data); // Guarda el PDF en localStorage
                                alert("PDF guardado y listo para descargar.");
                                loadView('my_pdfs'); // Ir a la vista de Mis PDFs
                            } else {
                                alert("No se guardó el PDF sin un nombre.");
                            }
                        }
                        reader.readAsDataURL(pdfBlob); // Convertir blob a Data URL
                        
                    } catch (err) {
                        console.error("Error al procesar la imagen:", err);
                        alert("Error al generar el PDF.");
                    } finally {
                        hideLoading();
                    }
                });

                // Botón para volver a tomar foto
                backToCameraBtn.addEventListener('click', initCamera);

                // Botón para volver a la Home
                backToHomeBtn.addEventListener('click', () => loadView('home'));
                break;
            default:
                console.warn('No hay inicialización específica para esta vista:', viewName);
        }
    }

    // --- Eventos Globales ---
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const viewName = item.dataset.view;
            if (viewName) {
                loadView(viewName);
            }
        });
    });

    // Cargar la vista de inicio por defecto
    loadView('home');
});