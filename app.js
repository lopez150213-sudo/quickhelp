// CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = 'https://pumnoszmbvcewozejrzm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vx6B5RPShC2PiWx5HzlFZw_d11C4H6Q';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Inicializar Mapa centrado en Granada, Nicaragua
const map = L.map('map').setView([11.9344, -85.9560], 14);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let markersLayer = L.layerGroup().addTo(map);
let tempMarker = null;
let audioHabilitado = false;

// Permitir hacer clic en el mapa para rellenar coordenadas en el modal
map.on('click', function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    const latInput = document.getElementById('latitud');
    const lngInput = document.getElementById('longitud');
    
    if(latInput) latInput.value = lat.toFixed(6);
    if(lngInput) lngInput.value = lng.toFixed(6);

    if (!document.getElementById('modal-reporte').classList.contains('hidden')) {
        if (tempMarker) {
            map.removeLayer(tempMarker);
        }
        tempMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'temp-pin',
                html: `<div class="bg-blue-600 text-white font-bold text-[10px] px-2.5 py-1 rounded-full shadow-lg border-2 border-white text-center whitespace-nowrap">📍 SELECCIONADO</div>`,
                iconSize: [95, 24],
                iconAnchor: [47, 12]
            })
        }).addTo(map);
    }
});

// Función para desbloquear el audio por interacción del usuario
function activarSonido() {
    audioHabilitado = true;
    reproducirAlertaSonora();
    const btn = document.getElementById('btn-audio');
    if(btn) {
        btn.innerHTML = '🔊 Alertas Activas';
        btn.classList.remove('bg-amber-600', 'hover:bg-amber-700');
        btn.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
    }
}

// Función para reproducir voz con acento latino anunciando la incidencia
function reproducirAlertaSonora() {
    if (!audioHabilitado) return;

    try {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();

            const mensaje = new SpeechSynthesisUtterance("¡Nueva incidencia!");
            mensaje.rate = 1.1; 
            mensaje.pitch = 1.0;
            mensaje.volume = 1.0;

            // Buscar una voz en español latino (México, Estados Unidos, Colombia, etc.)
            const voces = window.speechSynthesis.getVoices();
            const vozLatina = voces.find(voz => voz.lang.startsWith('es-MX') || voz.lang.startsWith('es-US') || voz.lang.startsWith('es-CO'));
            
            if (vozLatina) {
                mensaje.voice = vozLatina;
            } else {
                mensaje.lang = 'es-MX'; // Fallback a español latino genérico
            }

            window.speechSynthesis.speak(mensaje);
        } else {
            console.log("El navegador no soporta síntesis de voz.");
        }
    } catch(e) {
        console.log("Error al reproducir voz:", e);
    }
}

// Asegurar que las voces del sistema estén cargadas
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

async function cargarIncidentes() {
    const listContainer = document.getElementById('incidentes-list');
    listContainer.innerHTML = '<p class="text-sm text-slate-400 text-center py-4">Sincronizando con base de datos...</p>';

    markersLayer.clearLayers();

    const { data: incidentes, error } = await supabaseClient
        .from('incidentes')
        .select('*')
        .eq('estado', 'pendiente');

    if (error) {
        console.error('Error al cargar:', error);
        listContainer.innerHTML = '<p class="text-sm text-red-400 text-center">Error al conectar con Supabase.</p>';
        return;
    }

    const totalCount = incidentes ? incidentes.length : 0;
    document.getElementById('total-count').textContent = totalCount;
    const mobileCount = document.getElementById('total-count-mobile');
    if(mobileCount) mobileCount.textContent = totalCount;

    if (!incidentes || incidentes.length === 0) {
        listContainer.innerHTML = '<p class="text-xs text-slate-500 text-center py-6">No hay incidentes pendientes activos.</p>';
        return;
    }

    incidentes.forEach(inc => {
        const gravedad = inc.nivel_gravedad || 5;
        const vulnerabilidad = inc.vulnerabilidad_poblacion || 5;
        const riesgo = inc.riesgo_infraestructura || 5;
        
        inc.ipaCalculado = (gravedad * 4.0) + (vulnerabilidad * 3.5) + (riesgo * 2.5);
    });

    incidentes.sort((a, b) => b.ipaCalculado - a.ipaCalculado);
    listContainer.innerHTML = '';

    incidentes.forEach((inc, index) => {
        let ipaVal = inc.ipaCalculado;

        let badgeColor = 'bg-yellow-600';
        if (ipaVal >= 70) {
            badgeColor = 'bg-red-600 animate-pulse';
        } else if (ipaVal >= 50) {
            badgeColor = 'bg-orange-600';
        }

        // Miniatura de la evidencia fotográfica
        const evidenciaHTML = inc.foto_url 
            ? `<div style="margin-top: 8px;">
                 <img src="${inc.foto_url}" 
                      alt="Evidencia" 
                      onclick="verFotoAmpliada('${inc.foto_url}')"
                      style="width: 70px; height: 70px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                 <span style="display: block; font-size: 10px; color: #94a3b8; margin-top: 2px;">🔍 Clic para ampliar foto</span>
               </div>`
            : `<p style="font-size: 11px; color: #64748b; margin-top: 5px;">Sin evidencia fotográfica</p>`;

        const card = document.createElement('div');
        card.className = `bg-slate-800 border border-slate-700 p-3 rounded-xl shadow hover:border-slate-500 transition`;
        card.innerHTML = `
            <div class="flex justify-between items-start mb-1 cursor-pointer" onclick="centrarMapa(${inc.latitud}, ${inc.longitud})">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded text-white ${badgeColor}">IPA: ${ipaVal.toFixed(1)}</span>
                <span class="text-[10px] text-slate-400">#${index + 1} Prioridad</span>
            </div>
            <div class="cursor-pointer" onclick="centrarMapa(${inc.latitud}, ${inc.longitud})">
                <h3 class="font-bold text-slate-100 text-xs mb-1">${inc.titulo}</h3>
                <p class="text-[11px] text-slate-300 mb-2">${inc.descripcion || 'Sin descripción'}</p>
                ${evidenciaHTML}
            </div>
            <div class="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-700 pt-2 mt-2">
                <span>Reportó: <b>${inc.reportado_por || 'Comunidad'}</b></span>
                <div class="space-x-1">
                    <button onclick="cambiarEstado('${inc.id}', 'resuelto')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded font-semibold transition">✅ Atender</button>
                    <button onclick="eliminarIncidente('${inc.id}')" class="bg-rose-600 hover:bg-rose-700 text-white px-2 py-1 rounded font-semibold transition">🗑️ Eliminar</button>
                </div>
            </div>
        `;
        
        listContainer.appendChild(card);

        if (inc.latitud && inc.longitud) {
            const customIcon = L.divIcon({
                className: 'custom-map-badge',
                html: `<div class="${badgeColor} text-white font-bold text-[10px] px-2.5 py-1 rounded-full shadow-lg border-2 border-white text-center whitespace-nowrap">IPA: ${ipaVal.toFixed(1)}</div>`,
                iconSize: [60, 24],
                iconAnchor: [30, 12]
            });

            const marker = L.marker([inc.latitud, inc.longitud], { icon: customIcon }).addTo(markersLayer);
            
            // Si hay foto en el popup del mapa también la mostramos de forma opcional
            const fotoPopup = inc.foto_url ? `<br><img src="${inc.foto_url}" style="width: 100px; height: 70px; object-fit: cover; border-radius: 4px; margin-top: 4px; cursor: pointer;" onclick="verFotoAmpliada('${inc.foto_url}')">` : '';

            marker.bindPopup(`
                <div style="color: #1e293b;">
                    <b>${inc.titulo}</b><br>
                    <small>${inc.descripcion}</small><br>
                    <b>IPA:</b> ${ipaVal.toFixed(1)}<br>
                    <b>Estado:</b> ${inc.estado}
                    ${fotoPopup}<br><br>
                    <button onclick="cambiarEstado('${inc.id}', 'resuelto')" style="background: #059669; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">Marcar Atendido</button>
                </div>
            `);
        }
    });

    setTimeout(() => {
        map.invalidateSize();
    }, 200);
}

// CONFIGURAR SUPABASE REALTIME
supabaseClient
  .channel('cambios-incidentes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'incidentes' },
    (payload) => {
      console.log('Cambio detectado en tiempo real:', payload);
      if (payload.eventType === 'INSERT') {
        reproducirAlertaSonora();
      }
      cargarIncidentes();
    }
  )
  .subscribe();

function centrarMapa(lat, lng) {
    map.setView([lat, lng], 16);
}

function abrirModal() {
    document.getElementById('modal-reporte').classList.remove('hidden');
}

function cerrarModal() {
    document.getElementById('modal-reporte').classList.add('hidden');
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
}

async function guardarIncidente(event) {
    event.preventDefault();

    const nuevoIncidente = {
        titulo: document.getElementById('titulo').value,
        descripcion: document.getElementById('descripcion').value,
        latitud: parseFloat(document.getElementById('latitud').value),
        longitud: parseFloat(document.getElementById('longitud').value),
        nivel_gravedad: parseInt(document.getElementById('gravedad').value),
        vulnerabilidad_poblacion: parseInt(document.getElementById('vulnerabilidad').value),
        riesgo_infraestructura: parseInt(document.getElementById('riesgo').value),
        reportado_por: document.getElementById('reportado_por').value,
        estado: 'pendiente'
    };

    const { error } = await supabaseClient
        .from('incidentes')
        .insert([nuevoIncidente]);

    if (error) {
        console.error('Error al guardar incidente:', error);
        alert('Hubo un error al registrar el incidente.');
        return;
    }

    cerrarModal();
    document.getElementById('form-incidente').reset();
}

async function cambiarEstado(id, nuevoEstado) {
    const { error } = await supabaseClient
        .from('incidentes')
        .update({ estado: nuevoEstado })
        .eq('id', id);

    if (error) {
        console.error('Error al actualizar estado:', error);
        alert('No se pudo actualizar el estado.');
    }
}

async function eliminarIncidente(id) {
    if (!confirm('¿Estás seguro de eliminar este incidente del registro?')) return;

    const { error } = await supabaseClient
        .from('incidentes')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error al eliminar:', error);
        alert('No se pudo eliminar el incidente.');
    }
}

// Cargar al iniciar
cargarIncidentes();

// Funciones del Visor Dinámico (Modal) para las Fotos de Evidencia
function verFotoAmpliada(url) {
  let modal = document.getElementById('modalEvidencia');
  
  if (!modal) {
    const modalHTML = `
      <div id="modalEvidencia" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:99999; justify-content:center; align-items:center;">
        <div style="position:relative; max-width:85%; max-height:85%; text-align:center;">
          <button onclick="cerrarModalFoto()" style="position:absolute; top:-40px; right:0; background:#ff4d4d; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; font-weight:bold;">Cerrar X</button>
          <img id="imagenAmpliada" src="" style="width:100%; max-height:80vh; object-fit:contain; border-radius:8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    modal = document.getElementById('modalEvidencia');
  }

  const img = document.getElementById('imagenAmpliada');
  img.src = url;
  modal.style.display = 'flex';
}

function cerrarModalFoto() {
  const modal = document.getElementById('modalEvidencia');
  if (modal) {
    modal.style.display = 'none';
  }
}