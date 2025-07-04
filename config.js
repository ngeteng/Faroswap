// config.js

// ===================================================================================
// PENGATURAN OTOMATISASI (UBAH DI SINI)
// ===================================================================================

export const AUTOMATION_CONFIG = {
    // Tentukan urutan eksekusi. Skrip akan menjalankan fungsi sesuai urutan array ini.
    // Pilihan yang tersedia: 'deposit', 'withdraw', 'swap', 'addLP'
    execution_order: ['deposit', 'swap', 'addLP'],

    // Pengaturan delay antar setiap transaksi (bukan antar fungsi) dalam detik
    min_delay_seconds: 10,
    max_delay_seconds: 25,

    // Pengaturan untuk Deposit (PHRS -> WPHRS)
    deposit: {
        enabled: true, // set false jika tidak ingin menjalankan deposit
        amount: 0.01   // jumlah PHRS yang akan dideposit
    },

    // Pengaturan untuk Withdraw (WPHRS -> PHRS)
    withdraw: {
        enabled: false, // set false jika tidak ingin menjalankan withdraw
        amount: 0.01    // jumlah WPHRS yang akan di-withdraw
    },

    // Pengaturan untuk Swap
    swap: {
        enabled: true,    // set false jika tidak ingin menjalankan swap
        tx_count: 2,      // berapa kali swap akan dilakukan
        // Tentukan pasangan token dan jumlahnya. Skrip akan memilih secara acak dari list ini.
        pairs_and_amounts: [
            { from: 'WPHRS', to: 'USDC', amount: 0.005 },
            { from: 'USDC', to: 'WETH', amount: 1.5 },
            // { from: 'WETH', to: 'WPHRS', amount: 0.0001 } // Anda bisa tambah pasangan lain
        ]
    },
    
    // Pengaturan untuk Add Liquidity
    addLP: {
        enabled: true,   // set false jika tidak ingin menjalankan Add LP
        tx_count: 1,     // berapa kali Add LP akan dilakukan
        // Tentukan pasangan token dan jumlahnya. Skrip akan memilih secara acak dari list ini.
        pairs_and_amounts: [
            { tokenA: 'WPHRS', tokenB: 'USDC', amountA: 0.005 },
            { tokenA: 'WETH', tokenB: 'USDT', amountA: 0.0001 }
        ]
    },
    
    // Pengaturan jika ingin bot berjalan berulang-ulang (loop)
    run_in_loop: {
        enabled: false,  // set true jika ingin bot mengulang dari awal setelah selesai
        // Jeda waktu sebelum memulai loop baru, dalam menit
        loop_delay_minutes: 60 
    }
};


// ===================================================================================
// KONFIGURASI INTI (JANGAN DIUBAH KECUALI ANDA TAHU APA YANG DILAKUKAN)
// ===================================================================================

// Alamat-alamat kontrak
export const RPC_URL = "https://testnet.dplabs-internal.com";
export const PHRS_CONTRACT_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export const WPHRS_CONTRACT_ADDRESS = "0x3019B247381c850ab53Dc0EE53bCe7A07Ea9155f";
export const USDC_CONTRACT_ADDRESS = "0x72df0bcd7276f2dFbAc900D1CE63c272C4BCcCED";
export const USDT_CONTRACT_ADDRESS = "0xD4071393f8716661958F766DF660033b3d35fD29";
export const WETH_CONTRACT_ADDRESS = "0x4E28826d32F1C398DED160DC16Ac6873357d048f";
export const WBTC_CONTRACT_ADDRESS = "0x8275c526d1bCEc59a31d673929d3cE8d108fF5c7";
export const MIXSWAP_ROUTER_ADDRESS = "0x3541423f25A1Ca5C98fdBCf478405d3f0aaD1164";
export const POOL_ROUTER_ADDRESS = "0xf05Af5E9dC3b1dd3ad0C087BD80D7391283775e0";

// Ticker untuk kemudahan pemilihan
export const tickers = {
    PHRS: PHRS_CONTRACT_ADDRESS,
    WPHRS: WPHRS_CONTRACT_ADDRESS,
    USDC: USDC_CONTRACT_ADDRESS,
    USDT: USDT_CONTRACT_ADDRESS,
    WETH: WETH_CONTRACT_ADDRESS,
    WBTC: WBTC_CONTRACT_ADDRESS,
};

// Application Binary Interface (ABI) yang dibutuhkan
export const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function approve(address spender, uint256 amount) nonpayable returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function deposit() payable",
    "function withdraw(uint256 wad)"
];

export const UNISWAP_V2_ABI = [
    "function getAmountsOut(uint256 amountIn, address[] memory path, uint256[] memory fees) view returns (uint256[] memory amounts)",
    "function addLiquidity(address tokenA, address tokenB, uint256 fee, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) nonpayable returns (uint256, uint256, uint256)"
];
