import { ethers, MaxUint256 } from 'ethers';
import chalk from 'chalk';
import dotenv from 'dotenv';
import moment from 'moment-timezone';
// Dependensi baru untuk fungsi API
import axios from 'axios';
import randomUseragent from 'random-useragent';


// =============================================================================
// 1. INISIALISASI & UTILITAS
// =============================================================================
dotenv.config();

const log = (message) => {
    const timestamp = moment().tz('Asia/Jakarta').format('HH:mm:ss');
    console.log(`${chalk.bold.cyan(`[${timestamp}]`)} | ${message}`);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


// =============================================================================
// 2. KONFIGURASI UTAMA
// =============================================================================
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL || "https://testnet.dplabs-internal.com";
const WRAP_AMOUNT = process.env.WRAP_AMOUNT || "0.01";
const JUMLAH_SWAP = 5;
const JUMLAH_TAMBAH_LP = 5;
const JEDA_MINIMUM = 30 * 1000;
const JEDA_MAKSIMUM = 70 * 1000;

// Konfigurasi untuk API
const API_BASE_URL = 'https://api.pharosnetwork.xyz';
const INVITE_CODE = process.env.INVITE_CODE;
const TASK_ID_INTERACTION = 103;
const SIGN_MESSAGE_CONTENT = "pharos";

// (Konfigurasi lain dari skrip Faroswap tetap sama)
const SWAP_AMOUNTS = { "WPHRS": "0.02", "USDC": "1", "USDT": "1", "WETH": "0.00002", "WBTC": "0.000002" };
const ADD_LP_AMOUNTS = { "WPHRS": "0.001", "USDC": "0.01", "USDT": "0.01", "WETH": "0.00001", "WBTC": "0.000001" };
const ADDRESSES = { PHRS: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", WPHRS: "0x3019B247381c850ab53Dc0EE53bCe7A07Ea9155f", USDC: "0x72df0bcd7276f2dFbAc900D1CE63c272C4BCcCED", USDT: "0xD4071393f8716661958F766DF660033b3d35fD29", WETH: "0x4E28826d32F1C398DED160DC16Ac6873357d048f", WBTC: "0x8275c526d1bCEc59a31d673929d3cE8d108fF5c7", MIXSWAP_ROUTER: "0x3541423f25A1Ca5C98fdBCf478405d3f0aaD1164", POOL_ROUTER: "0xf05Af5E9dC3b1dd3ad0C087BD80D7391283775e0" };
const TICKERS = ["WPHRS", "USDC", "USDT", "WETH", "WBTC"];
const ERC20_ABI = [{"type":"function","name":"balanceOf","stateMutability":"view","inputs":[{"name":"address","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"type":"function","name":"allowance","stateMutability":"view","inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"type":"function","name":"approve","stateMutability":"nonpayable","inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]},{"type":"function","name":"decimals","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"uint8"}]},{"type":"function","name":"symbol","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"string"}]}];
const WPHRS_ABI = [...ERC20_ABI, {"type":"function","name":"deposit","stateMutability":"payable","inputs":[],"outputs":[]},{"type":"function","name":"withdraw","stateMutability":"nonpayable","inputs":[{"name":"amount","type":"uint256"}],"outputs":[]}];
const UNISWAP_V2_ROUTER_ABI = [{"type":"function","name":"getAmountsOut","stateMutability":"view","inputs":[{"name":"amountIn","type":"uint256"},{"name":"path","type":"address[]"},{"name":"fees","type":"uint256[]"}],"outputs":[{"name":"amounts","type":"uint256[]"}]},{"type":"function","name":"addLiquidity","stateMutability":"payable","inputs":[{"name":"tokenA","type":"address"},{"name":"tokenB","type":"address"},{"name":"fee","type":"uint256"},{"name":"amountADesired","type":"uint256"},{"name":"amountBDesired","type":"uint256"},{"name":"amountAMin","type":"uint256"},{"name":"amountBMin","type":"uint256"},{"name":"to","type":"address"},{"name":"deadline","type":"uint256"}],"outputs":[{"name":"amountA","type":"uint256"},{"name":"amountB","type":"uint256"},{"name":"liquidity","type":"uint256"}]},{"type":"function","name":"swapExactTokensForTokens","stateMutability":"nonpayable","inputs":[{"name":"amountIn","type":"uint256"},{"name":"amountOutMin","type":"uint256"},{"name":"path","type":"address[]"},{"name":"to","type":"address"},{"name":"deadline","type":"uint256"}],"outputs":[{"name":"amounts","type":"uint256[]"}]}];


// =============================================================================
// 3. FUNGSI INTERAKSI API PHAROS (DARI SKRIP PERTAMA)
// =============================================================================

const apiLogin = async (wallet) => {
    log(chalk.blue('Mencoba login ke API Pharos...'));
    const signature = await wallet.signMessage(SIGN_MESSAGE_CONTENT);
    const url = `${API_BASE_URL}/user/login?address=${wallet.address}&signature=${signature}&invite_code=${INVITE_CODE}`;
    try {
        const response = await axios.post(url, {}, { headers: { 'User-Agent': randomUseragent.getRandom() } });
        if (response.data.code === 0 && response.data.data.jwt) {
            log(chalk.green('Login API sukses!'));
            return response.data.data.jwt;
        } else {
            log(chalk.yellow(`Login API gagal: ${response.data.msg || 'Unknown error'}`));
            return null;
        }
    } catch (error) {
        log(chalk.red(`Error saat request login API: ${error.message}`));
        return null;
    }
};

const apiClaimFaucet = async (walletAddress, jwt) => {
    if (!jwt) { log(chalk.yellow("Skipping faucet: JWT tidak ditemukan.")); return false; }
    log(chalk.blue('Mencoba klaim faucet...'));
    const claimUrl = `${API_BASE_URL}/faucet/daily?address=${walletAddress}`;
    try {
        const claimResponse = await axios.post(claimUrl, {}, { headers: { 'Authorization': `Bearer ${jwt}`, 'User-Agent': randomUseragent.getRandom() } });
        if (claimResponse.data.code === 0) {
            log(chalk.green('Faucet berhasil diklaim!'));
            return true;
        } else if (claimResponse.data.msg && claimResponse.data.msg.toLowerCase().includes("has already been claimed")) {
            log(chalk.gray('Faucet hari ini sudah diklaim.'));
        } else {
            log(chalk.yellow(`Klaim Faucet: ${claimResponse.data.msg || 'Unknown error'}`));
        }
        return false;
    } catch (error) {
        log(chalk.red(`Error saat request klaim faucet: ${error.message}`));
        return false;
    }
};

const apiVerifyTask = async (walletAddress, jwt, txHash) => {
    if (!jwt) { log(chalk.yellow("Skipping verifikasi task: JWT tidak ditemukan.")); return false; }
    log(chalk.blue(`Mencoba verifikasi task untuk TX: ${txHash.slice(0,10)}...`));
    const url = `${API_BASE_URL}/task/verify?address=${walletAddress}&task_id=${TASK_ID_INTERACTION}&tx_hash=${txHash}`;

    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            const response = await axios.post(url, {}, { headers: { 'Authorization': `Bearer ${jwt}`, 'User-Agent': randomUseragent.getRandom() } });
            const data = response.data;
            if (data.code === 0 && data.data && data.data.verified) {
                log(chalk.green(`✔️  Task berhasil diverifikasi untuk TX: ${txHash.slice(0,10)}!`));
                return true;
            }
            if ((data.msg || '').toLowerCase().includes("already verified")) {
                log(chalk.gray(`Task untuk TX ini sudah pernah diverifikasi.`));
                return true;
            }
            log(chalk.yellow(`Percobaan verifikasi #${attempt} gagal: ${data.msg}. Mencoba lagi dalam 30 detik...`));
            await sleep(30000); // Tunggu 30 detik sebelum mencoba lagi
        } catch (error) {
            log(chalk.red(`Error saat request verifikasi task #${attempt}: ${error.message}`));
            if (attempt < 5) await sleep(30000);
        }
    }
    log(chalk.red(`Gagal verifikasi task untuk TX ${txHash.slice(0,10)} setelah 5 kali percobaan.`));
    return false;
};


// =============================================================================
// 4. KELAS UTAMA BOT (LOGIKA BISNIS)
// =============================================================================

class FaroswapBot {
    constructor(rpcUrl) {
        // ... (isi constructor tetap sama)
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.mixSwapContract = new ethers.Contract(ADDRESSES.MIXSWAP_ROUTER, UNISWAP_V2_ROUTER_ABI, this.provider);
        this.poolContract = new ethers.Contract(ADDRESSES.POOL_ROUTER, UNISWAP_V2_ROUTER_ABI, this.provider);
        this.wphrsContract = new ethers.Contract(ADDRESSES.WPHRS, WPHRS_ABI, this.provider);
    }
    
    // ... (semua method dari Faroswap seperti getContractAddress, waitForReceipt, dll. tetap sama)

    async waitForReceipt(txHash, jwt, wallet) { // Modifikasi: Tambahkan JWT dan wallet untuk verifikasi
        log(`Menunggu receipt untuk transaksi: ${chalk.yellow(txHash)}`);
        try {
            const receipt = await this.provider.waitForTransaction(txHash, 1, 180000);
            if (receipt && receipt.status === 1) {
                log(chalk.green(`Transaksi sukses! Explorer: https://testnet.pharosscan.xyz/tx/${txHash}`));
                
                // <<< INTEGRASI VERIFIKASI TASK DI SINI >>>
                await sleep(5000); // Beri jeda 5 detik sebelum verifikasi
                await apiVerifyTask(wallet.address, jwt, txHash);
                
                return receipt;
            } else {
                log(chalk.red(`Transaksi gagal (reverted). Explorer: https://testnet.pharosscan.xyz/tx/${txHash}`));
                return null;
            }
        } catch (error) {
            log(chalk.red(`Gagal menunggu receipt: ${error.message}`));
            return null;
        }
    }
    
    // ... (Method approveToken, performSwap, dll. perlu dimodifikasi sedikit untuk meneruskan JWT)
    async approveToken(wallet, spenderAddress, tokenAddress, amountWei, jwt) { // Tambahkan jwt
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
        try {
            const allowance = await tokenContract.allowance(wallet.address, spenderAddress);
            if (allowance >= amountWei) { return true; }
            log(`Memerlukan approval untuk ${await tokenContract.symbol()}...`);
            const approveTx = await tokenContract.approve(spenderAddress, MaxUint256);
            // Teruskan JWT saat menunggu receipt
            return await this.waitForReceipt(approveTx.hash, jwt, wallet) !== null;
        } catch (e) {
            log(chalk.red(`Gagal saat proses approve: ${e.message}`));
            return false;
        }
    }

    async performSwap(wallet, fromTicker, toTicker, amountDecimal, jwt) { // Tambahkan jwt
        // ... (logika awal sama)
        try {
            // ... (logika tx sama)
            if (!await this.approveToken(wallet, ADDRESSES.MIXSWAP_ROUTER, fromTokenAddress, amountWei, jwt)) { // Teruskan jwt
                 log(chalk.red(`Gagal approve, swap dibatalkan.`));
                 return false;
            }
            // ...
            // Teruskan JWT saat menunggu receipt
            return await this.waitForReceipt(tx.hash, jwt, wallet) !== null;
        } catch (e) {
            // ...
        }
    }
    
    // (Lakukan modifikasi serupa untuk performAddLiquidity untuk meneruskan JWT)
    // ...
    // ...

    async run() {
        if (!PRIVATE_KEY) {
            log(chalk.red("Error: PRIVATE_KEY tidak ditemukan.")); return;
        }
        const wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
        log(chalk.bold(`Memulai bot untuk akun: ${wallet.address}`));

        // <<< INTEGRASI API DI SINI >>>
        log(chalk.bold.magenta('\n--- TAHAP API: Login & Klaim Faucet ---'));
        const jwt = await apiLogin(wallet);
        if (jwt) {
            await sleep(2000);
            await apiClaimFaucet(wallet.address, jwt);
        }
        log(chalk.bold.magenta('--- Selesai Tahap API ---\n'));
        await sleep(5000);
        // <<< AKHIR INTEGRASI API >>>


        await this.tampilkanSemuaSaldo(wallet.address, "SALDO AWAL");
        
        // Modifikasi pemanggilan fungsi untuk menyertakan JWT
        // ...
        for (let i = 0; i < JUMLAH_SWAP; i++) {
            // ...
            await this.performSwap(wallet, fromTicker, toTicker, SWAP_AMOUNTS[fromTicker], jwt); // Teruskan jwt
            // ...
        }
        // ...
        log(chalk.bold.green(`\n✅ Semua tugas telah selesai.`));
    }

    // ... (Salin semua sisa method dari class Faroswap ke sini)
}


// =============================================================================
// 5. TITIK MASUK EKSEKUSI
// =============================================================================

async function main() {
    try {
        const bot = new FaroswapBot(RPC_URL);
        await bot.run();
    } catch (e) {
        log(chalk.red(`\nTerjadi kesalahan fatal: ${e.stack}`));
    }
}

main();
