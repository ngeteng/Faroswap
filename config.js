// config.js (Hanya bagian AUTOMATION_CONFIG yang perlu diubah)

export const AUTOMATION_CONFIG = {
    execution_order: ['deposit', 'swap', 'addLP'],

    min_delay_seconds: 10,
    max_delay_seconds: 25,

    deposit: {
        enabled: true,
        amount: 0.5 // Dinaikkan sedikit untuk dana yang lebih cukup
    },

    withdraw: {
        enabled: false,
        amount: 0.2
    },

    swap: {
        enabled: true,
        tx_count: 2, // Akan menjalankan kedua pasangan di bawah ini secara berurutan
        pairs_and_amounts: [
            // PERBAIKAN: Jumlah dinaikkan agar tidak error "amount not enough"
            { from: 'WPHRS', to: 'USDC', amount: 0.2 }, 
            // Setelah swap pertama sukses, Anda akan punya USDC untuk swap kedua ini
            { from: 'USDC', to: 'WETH', amount: 10 }
        ]
    },
    
    addLP: {
        enabled: true,
        tx_count: 1,
        pairs_and_amounts: [
            // Gunakan sebagian kecil dari hasil deposit dan swap
            { tokenA: 'WPHRS', tokenB: 'USDC', amountA: 0.1 }
        ]
    },
    
    run_in_loop: {
        enabled: false, // Set false dulu untuk testing satu siklus
        loop_delay_minutes: 60 
    }
};

// ... (Sisa dari file config.js biarkan sama seperti sebelumnya) ...
