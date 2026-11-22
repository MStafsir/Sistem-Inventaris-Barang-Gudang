// Kunci penyimpanan lokal browser
const KEY_PRODUK = 'sigs_k1_produk_v1';
const KEY_SESI = 'sigs_k1_sesi_v1';

// Daftar akun demo lokal
const AKUN_DEMO = {
    'admin@gudang.com': { pass: 'admin123', nama: 'Admin Gudang', role: 'Admin' },
    'kepala@gudang.com': { pass: 'kepala123', nama: 'Kepala Gudang', role: 'Kepala Gudang' }
};

// Data awal gudang sembako
const DATA_AWAL = [
    { id: 1, kode: 'BRS-001', nama: 'Beras Premium 25 kg', kategori: 'Beras', satuan: 'Karung', stok: 85, stok_min: 20, harga: 310000 },
    { id: 2, kode: 'BRS-002', nama: 'Beras Medium 5 kg', kategori: 'Beras', satuan: 'Karung', stok: 3, stok_min: 10, harga: 68000 },
    { id: 3, kode: 'GLA-001', nama: 'Gula Pasir 1 kg', kategori: 'Gula', satuan: 'Kg', stok: 12, stok_min: 15, harga: 17500 },
    { id: 4, kode: 'MYK-001', nama: 'Minyak Goreng 2 L', kategori: 'Minyak Goreng', satuan: 'Liter', stok: 2, stok_min: 12, harga: 38000 },
    { id: 5, kode: 'MYK-002', nama: 'Minyak Goreng 1 L', kategori: 'Minyak Goreng', satuan: 'Liter', stok: 45, stok_min: 20, harga: 19500 },
    { id: 6, kode: 'TPG-001', nama: 'Tepung Terigu 1 kg', kategori: 'Tepung', satuan: 'Kg', stok: 64, stok_min: 25, harga: 12500 },
    { id: 7, kode: 'TPG-002', nama: 'Tepung Beras 1 kg', kategori: 'Tepung', satuan: 'Kg', stok: 8, stok_min: 15, harga: 14000 },
    { id: 8, kode: 'TLR-001', nama: 'Telur Ayam (Tray 30)', kategori: 'Telur', satuan: 'Tray', stok: 40, stok_min: 15, harga: 52000 }
];

// Variabel state utama aplikasi
let produkList = [];
let userAktif = null;
let sortKey = 'kode';
let sortDir = 1;
let halamanAktif = 1;
const PER_HALAMAN = 6;
let hanyaKritis = false;
let grafikKategori = null;
let idTargetHapus = null;
let modeEdit = false;

// Sanitasi teks cegah XSS
function esc(teks) {
    return String(teks || '').replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

// Format angka menjadi Rupiah
function rupiah(nilai) {
    return 'Rp ' + (Number(nilai) || 0).toLocaleString('id-ID');
}

// Tentukan level status stok
function levelStok(stok) {
    const s = Number(stok);
    if (s < 5) return 'Kritis';
    if (s < 10) return 'Menipis';
    return 'Aman';
}

// Buat badge warna stok
function buatBadgeStok(stok, satuan) {
    const s = Number(stok);
    const labelSatuan = satuan ? ' ' + esc(satuan) : '';
    if (s < 5) {
        return '<span class="badge bg-danger mono-text">' + s + labelSatuan + ' &middot; Kritis</span>';
    }
    if (s < 10) {
        return '<span class="badge bg-warning text-dark mono-text">' + s + labelSatuan + ' &middot; Menipis</span>';
    }
    return '<span class="badge bg-success mono-text">' + s + labelSatuan + ' &middot; Aman</span>';
}

// Tampilkan notifikasi toast Bootstrap
function tampilkanToast(pesan, tipe) {
    const warna = tipe === 'danger' ? 'text-bg-danger' : 'text-bg-success';
    $('#toast').removeClass('text-bg-success text-bg-danger').addClass(warna);
    $('#toastMsg').text(pesan);
    bootstrap.Toast.getOrCreateInstance('#toast', { delay: 2400 }).show();
}

// Muat data dari localStorage
function muatProduk() {
    try {
        const raw = localStorage.getItem(KEY_PRODUK);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                produkList = parsed;
                $('#statusStorage').text('localStorage Tersinkron');
                return;
            }
        }
    } catch (e) {
        $('#statusStorage').text('Mode Array Statis');
    }
    produkList = JSON.parse(JSON.stringify(DATA_AWAL));
    simpanProduk();
}

// Simpan data ke localStorage
function simpanProduk() {
    try {
        localStorage.setItem(KEY_PRODUK, JSON.stringify(produkList));
        $('#statusStorage').text('localStorage Tersinkron');
    } catch (e) {
        $('#statusStorage').text('Mode Array Statis');
    }
}

// Muat sesi pengguna lokal
function muatSesi() {
    try {
        const raw = localStorage.getItem(KEY_SESI);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

// Simpan sesi pengguna lokal
function simpanSesi(user) {
    try {
        if (user) localStorage.setItem(KEY_SESI, JSON.stringify(user));
        else localStorage.removeItem(KEY_SESI);
    } catch (e) { }
}

// Isi pilihan dropdown kategori
function isiDropdownKategori() {
    const daftarKat = Array.from(new Set(produkList.map(function (p) { return p.kategori; }))).sort();
    ['#cat', '#rCat'].forEach(function (sel) {
        const nilaiLama = $(sel).val();
        $(sel).html('<option value="">Semua Kategori</option>');
        daftarKat.forEach(function (k) {
            $(sel).append($('<option>').val(k).text(k));
        });
        $(sel).val(nilaiLama);
    });
}

// Tampilkan halaman aktif terpilih
function tampilkanView(namaView) {
    $('.view').addClass('d-none');
    $('#v-' + namaView).removeClass('d-none');
    const navAktif = (namaView === 'form' || namaView === 'detail') ? 'produk' : namaView;
    $('.sidebar .nav-link').removeClass('active').filter('[data-view="' + navAktif + '"]').addClass('active');
    $('#viewApp').removeClass('open');

    if (namaView === 'dashboard') renderDashboard();
    if (namaView === 'produk') renderTabelProduk();
    if (namaView === 'laporan') renderLaporan();
}

// Masuk ke antarmuka utama
function masukAplikasi(user) {
    userAktif = user;
    simpanSesi(user);
    $('#viewLogin').addClass('d-none');
    $('#viewApp').removeClass('d-none');
    $('#userName').text(user.nama + ' (' + user.role + ')');
    muatProduk();
    isiDropdownKategori();
    tampilkanView('dashboard');
}

// Render metrik dan grafik
function renderDashboard() {
    let aman = 0;
    let menipis = 0;
    let kritis = 0;
    let totalNilai = 0;

    produkList.forEach(function (p) {
        const lv = levelStok(p.stok);
        if (lv === 'Aman') aman++;
        else if (lv === 'Menipis') menipis++;
        else kritis++;
        totalNilai += Number(p.harga) * Number(p.stok);
    });

    $('#sTotal').text(produkList.length);
    $('#sOk').text(aman);
    $('#sLow').text(menipis);
    $('#sOut').text(kritis);
    $('#sNilai').text(rupiah(totalNilai));

    const persenAman = produkList.length ? Math.round((aman / produkList.length) * 100) : 100;
    $('#barKesehatan').css('width', persenAman + '%');
    $('#barKesehatan').css('background-color', kritis > 0 ? '#dc2626' : '#16a34a');

    const barisPerhatian = produkList
        .filter(function (p) { return Number(p.stok) < 10; })
        .sort(function (a, b) { return Number(a.stok) - Number(b.stok); })
        .map(function (p) {
            return '<tr>' +
                '<td class="mono-text fw-semibold">' + esc(p.kode) + '</td>' +
                '<td>' + esc(p.nama) + '</td>' +
                '<td class="text-center">' + buatBadgeStok(p.stok, p.satuan) + '</td>' +
                '<td class="text-end"><button type="button" class="btn btn-outline-primary btn-sm act-edit" data-id="' + p.id + '">Restok</button></td>' +
                '</tr>';
        });

    $('#tLow').html(barisPerhatian.join('') || '<tr><td colspan="4" class="text-center text-muted py-4">Seluruh stok produk dalam kondisi aman.</td></tr>');

    const hitungKat = {};
    produkList.forEach(function (p) {
        hitungKat[p.kategori] = (hitungKat[p.kategori] || 0) + 1;
    });

    if (typeof Chart !== 'undefined') {
        if (grafikKategori) grafikKategori.destroy();
        grafikKategori = new Chart(document.getElementById('chart'), {
            type: 'bar',
            data: {
                labels: Object.keys(hitungKat),
                datasets: [{
                    data: Object.values(hitungKat),
                    backgroundColor: '#1d4ed8',
                    borderRadius: 5
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
            }
        });
    }
}

// Saring dan urutkan produk
function ambilProdukTerfilter() {
    const kata = ($('#q').val() || '').toString().trim().toLowerCase();
    const kat = $('#cat').val() || '';

    return produkList.filter(function (p) {
        const cocokKat = !kat || p.kategori === kat;
        const cocokCari = p.nama.toLowerCase().indexOf(kata) > -1 || p.kode.toLowerCase().indexOf(kata) > -1;
        const cocokKritis = !hanyaKritis || Number(p.stok) < 5;
        return cocokKat && cocokCari && cocokKritis;
    }).sort(function (a, b) {
        let x = a[sortKey];
        let y = b[sortKey];
        if (!isNaN(x) && !isNaN(y)) {
            x = Number(x);
            y = Number(y);
        }
        return (x > y ? 1 : x < y ? -1 : 0) * sortDir;
    });
}

// Render tabel dan kartu
function renderTabelProduk() {
    const data = ambilProdukTerfilter();
    const totalHal = Math.max(1, Math.ceil(data.length / PER_HALAMAN));
    if (halamanAktif > totalHal) halamanAktif = totalHal;

    const tampil = data.slice((halamanAktif - 1) * PER_HALAMAN, halamanAktif * PER_HALAMAN);
    let htmlTabel = '';
    let htmlKartu = '';

    tampil.forEach(function (p, idx) {
        const noUrut = (halamanAktif - 1) * PER_HALAMAN + idx + 1;
        const subtotal = Number(p.harga) * Number(p.stok);
        const tombolAksi =
            '<button type="button" class="btn btn-outline-secondary btn-sm act-view me-1" data-id="' + p.id + '">Lihat</button>' +
            '<button type="button" class="btn btn-outline-primary btn-sm act-edit me-1" data-id="' + p.id + '">Ubah</button>' +
            '<button type="button" class="btn btn-outline-danger btn-sm act-del" data-id="' + p.id + '">Hapus</button>';

        htmlTabel += '<tr>' +
            '<td class="mono-text">' + noUrut + '</td>' +
            '<td class="mono-text fw-semibold">' + esc(p.kode) + '</td>' +
            '<td class="fw-semibold">' + esc(p.nama) + '</td>' +
            '<td><span class="badge text-bg-light border">' + esc(p.kategori) + '</span></td>' +
            '<td class="text-end mono-text">' + rupiah(p.harga) + '</td>' +
            '<td class="text-center">' + buatBadgeStok(p.stok, p.satuan) + '</td>' +
            '<td class="text-end mono-text fw-semibold">' + rupiah(subtotal) + '</td>' +
            '<td class="text-end text-nowrap">' + tombolAksi + '</td>' +
            '</tr>';

        htmlKartu += '<div class="col-12 col-md-6">' +
            '<div class="card panel-card h-100"><div class="card-body">' +
            '<div class="d-flex justify-content-between align-items-start gap-2 mb-1">' +
            '<div><div class="fw-bold">' + esc(p.nama) + '</div><div class="small text-muted mono-text">' + esc(p.kode) + ' &middot; ' + esc(p.kategori) + '</div></div>' +
            buatBadgeStok(p.stok, p.satuan) + '</div>' +
            '<div class="my-2 mono-text small">Harga: <strong>' + rupiah(p.harga) + '</strong> &middot; Subtotal: <strong>' + rupiah(subtotal) + '</strong></div>' +
            '<div class="pt-1">' + tombolAksi + '</div>' +
            '</div></div></div>';
    });

    $('#tProduk').html(htmlTabel || '<tr><td colspan="8" class="text-center text-muted py-4">Tidak ada produk yang cocok dengan filter aktif.</td></tr>');
    $('#wrapCard').html(htmlKartu || '<div class="col-12"><div class="card panel-card p-4 text-center text-muted">Tidak ada produk yang cocok.</div></div>');

    const totalNilaiTampil = data.reduce(function (acc, p) { return acc + Number(p.harga) * Number(p.stok); }, 0);
    $('#totalNilai').text('Total nilai inventaris: ' + rupiah(totalNilaiTampil));

    let htmlPager = '';
    for (let i = 1; i <= totalHal; i++) {
        htmlPager += '<li class="page-item' + (i === halamanAktif ? ' active' : '') + '"><a class="page-link" href="#hal-' + i + '" data-p="' + i + '">' + i + '</a></li>';
    }
    $('#pager').html(htmlPager);
}

// Buka form tambah edit
function bukaFormProduk(item) {
    const $form = $('#fProduk');
    $form[0].reset();
    $form.find('.is-invalid').removeClass('is-invalid');
    $('#formErr').addClass('d-none');
    $('#fId').val(item ? item.id : '');
    $('#fKode').prop('readonly', !!item).toggleClass('ro-input', !!item);
    modeEdit = !!item;

    if (item) {
        $('#fKode').val(item.kode);
        $('#fNama').val(item.nama);
        $('#fKat').val(item.kategori);
        $('#fSat').val(item.satuan);
        $('#fHarga').val(item.harga);
        $('#fStok').val(item.stok);
        $('#fMin').val(item.stok_min);
        $form.appendTo('#mEditBody');
        bootstrap.Modal.getOrCreateInstance('#mEdit').show();
    } else {
        $form.appendTo('#formHolder .card-body');
        tampilkanView('form');
    }
}

// Validasi form client-side jQuery
function validasiFormProduk() {
    let valid = true;
    $('#fProduk .form-control, #fProduk .form-select').each(function () {
        const $el = $(this);
        const val = $.trim($el.val());
        let salah = !val;

        if (!salah && $el.attr('pattern')) {
            salah = !new RegExp('^' + $el.attr('pattern') + '$').test(val);
        }
        if (!salah && $el.attr('minlength')) {
            salah = val.length < Number($el.attr('minlength'));
        }
        if (!salah && $el.attr('type') === 'number') {
            salah = !/^\d+$/.test(val) || Number(val) < Number($el.attr('min'));
        }

        $el.toggleClass('is-invalid', salah);
        if (salah) valid = false;
    });
    return valid;
}

// Ambil data laporan terfilter
function ambilDataLaporan() {
    const kat = $('#rCat').val() || '';
    const st = $('#rSt').val() || '';
    return produkList.filter(function (p) {
        return (!kat || p.kategori === kat) && (!st || levelStok(p.stok) === st);
    });
}

// Render halaman laporan stok
function renderLaporan() {
    if (!$('#rTgl').val()) {
        $('#rTgl').val(new Date().toISOString().slice(0, 10));
    }
    const data = ambilDataLaporan();
    const rekap = { Aman: 0, Menipis: 0, Kritis: 0 };
    produkList.forEach(function (p) { rekap[levelStok(p.stok)]++; });

    const kartuStat = [
        ['Stok Aman (>= 10)', rekap.Aman, 'text-success'],
        ['Stok Menipis (5-9)', rekap.Menipis, 'text-warning'],
        ['Stok Kritis (< 5)', rekap.Kritis, 'text-danger']
    ].map(function (x) {
        return '<div class="col-12 col-md-4"><div class="card stat-card"><div class="card-body">' +
            '<span class="stat-label">' + x[0] + '</span>' +
            '<div class="stat-value ' + x[2] + '">' + x[1] + '</div>' +
            '</div></div></div>';
    }).join('');
    $('#rStat').html(kartuStat);

    const barisLap = data.map(function (p, i) {
        const subtotal = Number(p.harga) * Number(p.stok);
        return '<tr>' +
            '<td class="mono-text">' + (i + 1) + '</td>' +
            '<td class="mono-text fw-semibold">' + esc(p.kode) + '</td>' +
            '<td>' + esc(p.nama) + '</td>' +
            '<td>' + esc(p.kategori) + '</td>' +
            '<td class="text-end mono-text">' + rupiah(p.harga) + '</td>' +
            '<td class="text-center">' + buatBadgeStok(p.stok, p.satuan) + '</td>' +
            '<td class="text-end mono-text fw-semibold">' + rupiah(subtotal) + '</td>' +
            '</tr>';
    }).join('');
    $('#tLap').html(barisLap || '<tr><td colspan="7" class="text-center text-muted py-4">Tidak ada data laporan.</td></tr>');
}

// Ekspor daftar ke CSV
function eksporCsv(sumberData) {
    const daftar = sumberData && sumberData.length ? sumberData : produkList;
    if (!daftar.length) {
        tampilkanToast('Tidak ada data untuk diekspor.', 'danger');
        return;
    }
    const tgl = $('#rTgl').val() || new Date().toISOString().slice(0, 10);
    const baris = [['Kode', 'Nama Produk', 'Kategori', 'Harga', 'Stok', 'Satuan', 'Status', 'Subtotal']].concat(
        daftar.map(function (p) {
            return [p.kode, p.nama, p.kategori, p.harga, p.stok, p.satuan, levelStok(p.stok), Number(p.harga) * Number(p.stok)];
        })
    );

    const isiCsv = '\uFEFF' + baris.map(function (r) {
        return r.map(function (sel) {
            const s = String(sel).replace(/"/g, '""');
            return '"' + s + '"';
        }).join(',');
    }).join('\r\n');

    const blob = new Blob([isiCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const $link = $('<a>', { href: url, download: 'inventaris-gudang-k1-' + tgl + '.csv' }).appendTo('body');
    $link[0].click();
    $link.remove();
    URL.revokeObjectURL(url);
    tampilkanToast('File CSV inventaris berhasil diunduh.', 'success');
}

// Cari produk berdasarkan ID
function cariProdukById(el) {
    const id = Number($(el).data('id'));
    return produkList.find(function (p) { return Number(p.id) === id; });
}

// Inisialisasi event saat siap
$(function () {
    const sesiLama = muatSesi();
    if (sesiLama) {
        masukAplikasi(sesiLama);
    }

    // Tombol isi akun demo
    $('#btnDemoAdmin').on('click', function () {
        $('#lEmail').val('admin@gudang.com');
        $('#lPass').val('admin123');
    });

    $('#btnDemoKepala').on('click', function () {
        $('#lEmail').val('kepala@gudang.com');
        $('#lPass').val('kepala123');
    });

    // Event submit form login
    $('#fLogin').on('submit', function (e) {
        e.preventDefault();
        const em = $.trim($('#lEmail').val()).toLowerCase();
        const pw = $('#lPass').val();
        const errEmail = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
        const errPass = pw.length < 6;
        $('#lEmail').toggleClass('is-invalid', errEmail);
        $('#lPass').toggleClass('is-invalid', errPass);
        if (errEmail || errPass) return;

        const akun = AKUN_DEMO[em];
        if (akun && akun.pass === pw) {
            $('#loginErr').addClass('d-none');
            $('#lPass').val('');
            masukAplikasi({ nama: akun.nama, role: akun.role });
            tampilkanToast('Selamat datang, ' + akun.nama + '.', 'success');
        } else {
            $('#loginErr').text('Email atau kata sandi tidak cocok. Gunakan tombol akun demo di bawah.').removeClass('d-none');
            $('#lEmail, #lPass').addClass('is-invalid');
        }
    });

    // Event navigasi dan sidebar
    $(document).on('click', '[data-view]', function (e) {
        e.preventDefault();
        tampilkanView($(this).data('view'));
    });

    $('#btnMenu, #sidebarBackdrop').on('click', function () {
        $('#viewApp').toggleClass('open');
    });

    $('#btnLogout').on('click', function (e) {
        e.preventDefault();
        bootstrap.Modal.getOrCreateInstance('#mLogout').show();
    });

    $('#btnYaLogout').on('click', function () {
        simpanSesi(null);
        userAktif = null;
        bootstrap.Modal.getOrCreateInstance('#mLogout').hide();
        $('#viewApp').addClass('d-none');
        $('#viewLogin').removeClass('d-none');
        $('#lEmail').val('');
        tampilkanToast('Sesi login telah diakhiri.', 'success');
    });

    $('#btnResetAwal').on('click', function () {
        produkList = JSON.parse(JSON.stringify(DATA_AWAL));
        simpanProduk();
        isiDropdownKategori();
        renderDashboard();
        renderTabelProduk();
        tampilkanToast('Data dikembalikan ke 8 produk awal.', 'success');
    });

    // Event pencarian filter sort
    $('#q').on('input', function () {
        halamanAktif = 1;
        renderTabelProduk();
    });

    $('#cat').on('change', function () {
        halamanAktif = 1;
        renderTabelProduk();
    });

    $('#btnToggleKritis').on('click', function () {
        hanyaKritis = !hanyaKritis;
        $(this).toggleClass('btn-danger', hanyaKritis).toggleClass('btn-outline-danger', !hanyaKritis).attr('aria-pressed', String(hanyaKritis));
        halamanAktif = 1;
        renderTabelProduk();
    });

    $('th.sortable').on('click', function () {
        const k = $(this).data('k');
        sortDir = sortKey === k ? -sortDir : 1;
        sortKey = k;
        renderTabelProduk();
    });

    $('#pager').on('click', 'a', function (e) {
        e.preventDefault();
        halamanAktif = Number($(this).data('p'));
        renderTabelProduk();
    });

    $('#viewTable, #viewCard').on('click', function () {
        const isCard = this.id === 'viewCard';
        $('#viewTable').toggleClass('active', !isCard);
        $('#viewCard').toggleClass('active', isCard);
        $('#cardWrapTable').toggleClass('d-none', isCard);
        $('#wrapCard').toggleClass('d-none', !isCard);
    });

    // Event hover baris tabel
    $('#tProduk').on('mouseenter', 'tr', function () {
        $(this).css('background-color', '#f8fafc');
    }).on('mouseleave', 'tr', function () {
        $(this).css('background-color', '');
    });

    // Event ekspor file CSV
    $('#btnCsvProduk').on('click', function () {
        eksporCsv(ambilProdukTerfilter());
    });

    $('#btnCsv').on('click', function () {
        eksporCsv(ambilDataLaporan());
    });

    $('#rCat, #rSt').on('change', renderLaporan);

    // Event tambah lihat edit
    $('#btnAdd, #btnDashTambah').on('click', function () {
        bukaFormProduk(null);
    });

    $('#btnBatal, #btnBatalAtas').on('click', function () {
        if (modeEdit) bootstrap.Modal.getOrCreateInstance('#mEdit').hide();
        else tampilkanView('produk');
    });

    $('#btnKembali').on('click', function () {
        tampilkanView('produk');
    });

    $(document).on('click', '.act-view', function () {
        const p = cariProdukById(this);
        if (!p) return;
        const daftarField = [
            ['Kode Produk', p.kode],
            ['Nama Produk', p.nama],
            ['Kategori', p.kategori],
            ['Satuan', p.satuan],
            ['Harga Satuan', rupiah(p.harga)],
            ['Jumlah Stok', p.stok + ' ' + p.satuan],
            ['Stok Minimum', p.stok_min + ' ' + p.satuan],
            ['Total Nilai Stok', rupiah(Number(p.harga) * Number(p.stok))]
        ];
        const htmlDetail = daftarField.map(function (f) {
            return '<div class="col-12 col-md-6"><label class="form-label">' + f[0] + '</label>' +
                '<input class="form-control ro-input mono-text" readonly value="' + esc(f[1]) + '"></div>';
        }).join('') +
            '<div class="col-12"><label class="form-label d-block">Status Stok</label>' + buatBadgeStok(p.stok, p.satuan) + '</div>';
        $('#detailBody').html(htmlDetail);
        tampilkanView('detail');
    });

    $(document).on('click', '.act-edit', function () {
        const p = cariProdukById(this);
        if (p) bukaFormProduk(p);
    });

    // Event hapus dengan modal
    $(document).on('click', '.act-del', function () {
        const p = cariProdukById(this);
        if (!p) return;
        idTargetHapus = p.id;
        $('#hapusNama').html('<strong>' + esc(p.kode) + '</strong> &mdash; ' + esc(p.nama) + '<br>Stok: ' + p.stok + ' ' + esc(p.satuan));
        bootstrap.Modal.getOrCreateInstance('#mHapus').show();
    });

    $('#btnYaHapus').on('click', function () {
        produkList = produkList.filter(function (p) { return Number(p.id) !== Number(idTargetHapus); });
        idTargetHapus = null;
        simpanProduk();
        isiDropdownKategori();
        bootstrap.Modal.getOrCreateInstance('#mHapus').hide();
        renderTabelProduk();
        renderDashboard();
        tampilkanToast('Produk berhasil dihapus dari inventaris.', 'success');
    });

    // Event simpan form produk
    $('#fProduk').on('submit', function (e) {
        e.preventDefault();
        if (!validasiFormProduk()) {
            $('#formErr').text('Periksa kembali kolom bertanda merah. Harga dan stok wajib angka positif.').removeClass('d-none');
            return;
        }

        const idEdit = Number($('#fId').val());
        const kodeBaru = $.trim($('#fKode').val()).toUpperCase();
        const dataBaru = {
            id: idEdit || (produkList.reduce(function (m, p) { return Math.max(m, Number(p.id)); }, 0) + 1),
            kode: kodeBaru,
            nama: $.trim($('#fNama').val()),
            kategori: $('#fKat').val(),
            satuan: $('#fSat').val(),
            harga: Number($('#fHarga').val()),
            stok: Number($('#fStok').val()),
            stok_min: Number($('#fMin').val())
        };

        if (idEdit) {
            const idx = produkList.findIndex(function (p) { return Number(p.id) === idEdit; });
            if (idx > -1) produkList[idx] = dataBaru;
            bootstrap.Modal.getOrCreateInstance('#mEdit').hide();
            tampilkanToast('Perubahan data produk berhasil disimpan.', 'success');
        } else {
            const duplikat = produkList.some(function (p) { return p.kode.toUpperCase() === kodeBaru; });
            if (duplikat) {
                $('#fKode').addClass('is-invalid');
                $('#formErr').text('Kode produk ' + kodeBaru + ' sudah terdaftar.').removeClass('d-none');
                return;
            }
            produkList.push(dataBaru);
            tampilkanToast('Produk baru berhasil ditambahkan.', 'success');
        }

        simpanProduk();
        isiDropdownKategori();
        tampilkanView('produk');
    });

    // Kembalikan form setelah modal
    $('#mEdit').on('hidden.bs.modal', function () {
        $('#fProduk').appendTo('#formHolder .card-body');
        modeEdit = false;
    });
});
