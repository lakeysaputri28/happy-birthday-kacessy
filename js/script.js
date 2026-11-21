let spotifyController = null;
let spotifyPendingPlay = false;
let spotifyPlaying = false;
let unlockScroll = () => {};

document.addEventListener('DOMContentLoaded', () => {

  /* --- COVER: Tap To Open --- */
  const cover  = document.getElementById('cover');
  const site   = document.getElementById('site');
  const hearts = document.getElementById('floatingHearts');

  /* --- MUSIK --- */
  const bgMusic   = document.getElementById('bgMusic');
  const musicBtn  = document.getElementById('musicToggle');
  const musicIcon = musicBtn ? musicBtn.querySelector('.music-icon') : null;
  const musicText = musicBtn ? musicBtn.querySelector('.music-text') : null;
  let localTrackOk = false;   // true kalau audio/all-too-well.mp3 bisa diputar

  /* --- BATAS SCROLL: cukup sampai tombol musik terlihat --- */
  let scrollLocked = true;
  let coverOpened = false;
  let lastTouchY = 0;

  const getScrollLimit = () => {
    if (!coverOpened || !musicBtn) return 0;
    const rect = musicBtn.getBoundingClientRect();
    // Berhenti saat tombol masih terlihat ~90px sebelum bawah layar
    return Math.max(0, rect.bottom + window.scrollY - window.innerHeight + 90);
  };

  const clampScroll = () => {
    if (!scrollLocked) return;
    const limit = getScrollLimit();
    if (window.scrollY > limit) window.scrollTo(0, limit);
  };

  const blockScroll = (e) => {
    if (!scrollLocked) return;
    const limit = getScrollLimit();
    if (window.scrollY < limit - 1) return;

    let delta = 0;
    if (e.type === 'wheel') delta = e.deltaY;
    else if (e.touches && e.touches.length) delta = lastTouchY - e.touches[0].clientY;

    if (delta > 0) e.preventDefault(); // tolak scroll lanjut ke bawah
  };

  const trackTouch = (e) => {
    if (e.touches && e.touches.length) lastTouchY = e.touches[0].clientY;
  };

  const lockScroll = () => {
    scrollLocked = true;
    document.documentElement.classList.add('scroll-locked');
    document.body.classList.add('scroll-locked');
    window.addEventListener('wheel', blockScroll, { passive: false });
    window.addEventListener('touchmove', blockScroll, { passive: false });
    window.addEventListener('touchstart', trackTouch, { passive: true });
    window.addEventListener('scroll', clampScroll, { passive: true });
  };

  unlockScroll = () => {
    if (!scrollLocked) return;
    scrollLocked = false;
    document.documentElement.classList.remove('scroll-locked');
    document.body.classList.remove('scroll-locked');
    window.removeEventListener('wheel', blockScroll);
    window.removeEventListener('touchmove', blockScroll);
    window.removeEventListener('touchstart', trackTouch);
    window.removeEventListener('scroll', clampScroll);
  };

  lockScroll();

  const isMusicPlaying = () => (bgMusic && !bgMusic.paused) || spotifyPlaying;

  const refreshMusicButton = () => {
    if (!musicBtn) return;
    const playing = isMusicPlaying();

    musicBtn.classList.toggle('is-playing', playing);
    musicBtn.classList.toggle('is-local', localTrackOk);
    musicBtn.setAttribute('aria-pressed', String(playing));

    if (musicIcon) musicIcon.textContent = playing ? '❚❚' : '♪';
    if (musicText) musicText.textContent = playing
      ? 'Jeda musik'
      : (localTrackOk ? 'Putar musik' : 'Putar lagu');
    musicBtn.title = playing ? 'Matikan musik' : 'Nyalakan musik';
  };

  if (bgMusic) {
    bgMusic.addEventListener('canplay', () => { localTrackOk = true;  refreshMusicButton(); });
    bgMusic.addEventListener('error',   () => { localTrackOk = false; refreshMusicButton(); });
    bgMusic.addEventListener('play',    () => { unlockScroll(); refreshMusicButton(); });
    bgMusic.addEventListener('pause',   () => refreshMusicButton());
  }

  // Buat hearts melayang
  for (let i = 0; i < 20; i++) {
    const s = document.createElement('span');
    s.textContent = ['❤','💕','💗','✨','💖'][Math.floor(Math.random()*5)];
    s.style.left = Math.random()*100 + '%';
    s.style.animationDelay = Math.random()*4 + 's';
    s.style.animationDuration = (3 + Math.random()*3) + 's';
    s.style.fontSize = (1 + Math.random()*1.5) + 'rem';
    hearts.appendChild(s);
  }

  cover.addEventListener('click', () => {
    cover.classList.add('open');
    site.classList.remove('hidden');
    coverOpened = true;
    window.scrollTo(0, 0);
    // Scroll hanya boleh sampai tombol musik terlihat, sampai audio diputar

    // Musik tidak diputar otomatis: tunggu tombol ♪ di kartu ditekan
    if (bgMusic) bgMusic.volume = 0.7;

    setTimeout(() => cover.remove(), 900);
    refreshMusicButton();
  });

  /* --- Tombol musik di dalam kartu Spotify --- */
  if (musicBtn) {
    musicBtn.addEventListener('click', (e) => {
      e.stopPropagation();

      // Prioritas 1: musik latar lokal (audio/all-too-well.mp3)
      if (bgMusic) {
        if (bgMusic.paused) bgMusic.play().catch(() => {});
        else bgMusic.pause();
        return;
      }

      // Prioritas 2: kontrol player Spotify (kalau embed dipasang lagi)
      if (spotifyController) {
        try {
          if (spotifyPlaying) { spotifyController.pause(); return; }
          spotifyController.play();
        } catch (err) { /* diabaikan */ }

        // Kalau Spotify menolak play otomatis, beri petunjuk ke tombol play di player
        setTimeout(() => {
          if (!isMusicPlaying() && musicText) {
            musicText.textContent = 'Tekan ▶ di player';
            setTimeout(refreshMusicButton, 4000);
          }
        }, 1200);
        return;
      }

      // Player Spotify belum siap: coba lagi sebentar lagi
      spotifyPendingPlay = true;
      setTimeout(() => {
        if (spotifyController && spotifyPendingPlay) {
          spotifyPendingPlay = false;
          try { spotifyController.play(); } catch (err) {}
        }
      }, 1200);
    });
  }

  /* --- Stop musik otomatis saat halaman ditinggalkan --- */
  const stopMusicOnLeave = () => {
    if (bgMusic && !bgMusic.paused) bgMusic.pause();
    if (spotifyController) {
      try { spotifyController.pause(); } catch (e) {}
    }
  };

  // Pindah tab / minimize browser
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopMusicOnLeave();
  });

  // Tutup tab, refresh, atau navigate ke halaman lain
  window.addEventListener('pagehide', stopMusicOnLeave);
  window.addEventListener('beforeunload', stopMusicOnLeave);

  /* --- Reveal on Scroll (Intersection Observer) --- */
  const reveals = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });

  reveals.forEach(el => observer.observe(el));

  /* --- Sparkle on Title Hover --- */
  document.querySelectorAll('.glow-text').forEach(el => {
    el.addEventListener('mouseenter', () => {
      el.style.transition = 'text-shadow .3s ease';
      el.style.textShadow = '0 0 30px rgba(255,255,255,.9), 0 0 60px rgba(255,255,255,.6), 0 0 90px rgba(255,255,255,.3)';
    });
    el.addEventListener('mouseleave', () => {
      el.style.textShadow = '0 0 20px rgba(255,255,255,.7), 0 0 40px rgba(255,255,255,.4)';
    });
  });

  refreshMusicButton();
});

/* --- Spotify iFrame API --- */
window.onSpotifyIframeApiReady = (IFrameAPI) => {
  const el = document.getElementById('spotifyEmbed');
  if (!el) return;

  IFrameAPI.createController(el, {}, (controller) => {
    spotifyController = controller;

    // Kalau user sudah menekan tombol sebelum player siap, coba nyalakan sekarang
    if (spotifyPendingPlay) {
      spotifyPendingPlay = false;
      try { controller.play(); } catch (e) {}
    }

    controller.addListener('playback_update', (e) => {
      spotifyPlaying = !e.data.isPaused;
      if (spotifyPlaying) unlockScroll();

      const bgMusic = document.getElementById('bgMusic');
      if (spotifyPlaying && bgMusic && !bgMusic.paused) bgMusic.pause();

      const btn = document.getElementById('musicToggle');
      if (!btn) return;
      const playing = !!(spotifyPlaying || (bgMusic && !bgMusic.paused));
      btn.classList.toggle('is-playing', playing);
      btn.setAttribute('aria-pressed', String(playing));
      const icon = btn.querySelector('.music-icon');
      if (icon) icon.textContent = playing ? '❚❚' : '♪';
      const label = btn.querySelector('.music-text');
      if (label) label.textContent = playing ? 'Jeda musik' : 'Putar lagu';
    });
  });
};
