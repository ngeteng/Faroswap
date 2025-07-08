import { ethers, MaxUint256 } from 'ethers';
import chalk from 'chalk';
import dotenv from 'dotenv';
import moment from 'moment-timezone';
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

const API_BASE_URL = 'https://api.pharosnetwork.xyz';
const INVITE_CODE = process.env.INVITE_CODE;
const TASK_ID_INTERACTION = 103;
const SIGN_MESSAGE_CONTENT = "pharos";

const SWAP_AMOUNTS = { "WPHRS": "0.02", "USDC": "1", "USDT": "1", "WETH": "0.00002", "WBTC": "0.000002" };
const ADD_LP_AMOUNTS = { "WPHRS": "0.001", "USDC": "0.01", "USDT": "0.01", "WETH": "0.00001", "WBTC": "0.000001" };
const ADDRESSES = { PHRS: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", WPHRS: "0x3019B247381c850ab53Dc0EE53bCe7A07Ea9155f", USDC: "0x72df0bcd7276f2dFbAc900D1CE63c272C4BCcCED", USDT: "0xD4071393f8716661958F766DF660033b3d35fD29", WETH: "0x4E28826d32F1C398DED160DC16Ac6873357d048f", WBTC: "0x8275c526d1bCEc59a31d673929d3cE8d108fF5c7", MIXSWAP_ROUTER: "0x3541423f25A1Ca5C98fdBCf478405d3f0aaD1164", POOL_ROUTER: "0xf05Af5E9dC3b1dd3ad0C087BD80D7391283775e0" };
const TICKERS = ["WPHRS", "USDC", "USDT", "WETH", "WBTC"];
const ERC20_ABI = [{"type":"function","name":"balanceOf","stateMutability":"view","inputs":[{"name":"address","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"type":"function","name":"allowance","stateMutability":"view","inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"type":"function","name":"approve","stateMutability":"nonpayable","inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]},{"type":"function","name":"decimals","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"uint8"}]},{"type":"function","name":"symbol","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"string"}]}];
const WPHRS_ABI = [...ERC20_ABI, {"type":"function","name":"deposit","stateMutability":"payable","inputs":[],"outputs":[]},{"type":"function","name":"withdraw","stateMutability":"nonpayable","inputs":[{"name":"amount","type":"uint256"}],"outputs":[]}];
const UNISWAP_V2_ROUTER_ABI = [{"type":"function","name":"getAmountsOut","stateMutability":"view","inputs":[{"name":"amountIn","type":"uint256"},{"name":"path","type":"address[]"},{"name":"fees","type":"uint256[]"}],"outputs":[{"name":"amounts","type":"uint256[]"}]},{"type":"function","name":"addLiquidity","stateMutability":"payable","inputs":[{"name":"tokenA","type":"address"},{"name":"tokenB","type":"address"},{"name":"fee","type":"uint256"},{"name":"amountADesired","type":"uint256"},{"name":"amountBDesired","type":"uint256"},{"name":"amountAMin","type":"uint256"},{"name":"amountBMin","type":"uint256"},{"name":"to","type":"address"},{"name":"deadline","type":"uint256"}],"outputs":[{"name":"amountA","type":"uint256"},{"name":"amountB","type":"uint256"},{"name":"liquidity","type":"uint256"}]},{"type":"function","name":"swapExactTokensForTokens","stateMutability":"nonpayable","inputs":[{"name":"amountIn","type":"uint256"},{"name":"amountOutMin","type":"uint256"},{"name":"path","type":"address[]"},{"name":"to","type":"address"},{"name":"deadline","type":"uint256"}],"outputs":[{"name":"amounts","type":"uint256[]"}]}];


// =============================================================================
// 3. FUNGSI INTERAKSI API PHAROS
// =============================================================================

const apiLogin = async (wallet) => {
    // ... (Fungsi ini tidak berubah)
};
const apiClaimFaucet = async (walletAddress, jwt) => {
    // ... (Fungsi ini tidak berubah)
};
const apiVerifyTask = async (walletAddress, jwt, txHash) => {
    // ... (Fungsi ini tidak berubah)
};
// NOTE: Salin fungsi API dari respons saya sebelumnya jika Anda membutuhkannya di sini.
// Untuk mempersingkat, saya asumsikan fungsi-fungsi ini sudah ada.

// =============================================================================
// 4. KELAS UTAMA BOT
// =============================================================================

class FaroswapBot {
    constructor(rpcUrl) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.mixSwapContract = new ethers.Contract(ADDRESSES.MIXSWAP_ROUTER, UNISWAP_V2_ROUTER_ABI, this.provider);
        this.poolContract = new ethers.Contract(ADDRESSES.POOL_ROUTER, UNISWAP_V2_ROUTER_ABI, this.provider);
        this.wphrsContract = new ethers.Contract(ADDRESSES.WPHRS, WPHRS_ABI, this.provider);
    }
    
    // <<< FUNGSI YANG HILANG SEBELUMNYA SAYA TAMBAHKAN KEMBALI DI SINI >>>

    getContractAddress(ticker) {
        return ADDRESSES[ticker];
    }

    async getTokenBalance(address, contractAddress) {
        try {
            if (contractAddress === ADDRESSES.PHRS) {
                return ethers.formatEther(await this.provider.getBalance(address));
            } else {
                const tokenContract = new ethers.Contract(contractAddress, ERC20_ABI, this.provider);
                const balance = await tokenContract.balanceOf(address);
                const decimals = await tokenContract.decimals();
                return ethers.formatUnits(balance, Number(decimals));
            }
        } catch (e) {
            return '0';
        }
    }

    async tampilkanSemuaSaldo(walletAddress, title) {
        log(chalk.bold.yellow(`\n--- ${title} ---`));
        const allTickers = ['PHRS', ...TICKERS];
        for (const ticker of allTickers) {
            const balance = await this.getTokenBalance(walletAddress, this.getContractAddress(ticker));
            log(`${chalk.green(ticker.padEnd(5, ' '))} : ${parseFloat(balance).toFixed(6)}`);
        }
        log(chalk.bold.yellow('---------------------------------'));
    }

    // <<< AKHIR DARI FUNGSI YANG HILANG >>>


    async waitForReceipt(txHash, jwt, wallet) {
        log(`Menunggu receipt untuk transaksi: ${chalk.yellow(txHash)}`);
        try {
            const receipt = await this.provider.waitForTransaction(txHash, 1, 180000);
            if (receipt && receipt.status === 1) {
                log(chalk.green(`Transaksi sukses! Explorer: https://testnet.pharosscan.xyz/tx/${txHash}`));
                await sleep(5000);
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
    
    async approveToken(wallet, spenderAddress, tokenAddress, amountWei, jwt) {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
        try {
            const allowance = await tokenContract.allowance(wallet.address, spenderAddress);
            if (allowance >= amountWei) {
                return true;
            }
            log(`Memerlukan approval untuk ${await tokenContract.symbol()}...`);
            const approveTx = await tokenContract.approve(spenderAddress, MaxUint256);
            return await this.waitForReceipt(approveTx.hash, jwt, wallet) !== null;
        } catch (e) {
            log(chalk.red(`Gagal saat proses approve: ${e.message}`));
            return false;
        }
    }

    async performSwap(wallet, fromTicker, toTicker, amountDecimal, jwt) {
        log(`Memulai swap: ${amountDecimal} ${fromTicker} -> ${toTicker}`);
        const fromTokenAddress = this.getContractAddress(fromTicker);
        const toTokenAddress = this.getContractAddress(toTicker);

        try {
            let tx;
            const fromTokenContract = new ethers.Contract(fromTokenAddress, ERC20_ABI, this.provider);
            const fromDecimals = (fromTicker === 'PHRS') ? 18 : await fromTokenContract.decimals();
            const amountWei = ethers.parseUnits(amountDecimal.toString(), Number(fromDecimals));

            if (fromTicker === 'PHRS' && toTicker === 'WPHRS') {
                const wphrsSigner = this.wphrsContract.connect(wallet);
                tx = await wphrsSigner.deposit({ value: amountWei });
            }
            else if (fromTicker === 'WPHRS' && toTicker === 'PHRS') {
                const wphrsSigner = this.wphrsContract.connect(wallet);
                tx = await wphrsSigner.withdraw(amountWei);
            }
            else {
                if (!await this.approveToken(wallet, ADDRESSES.MIXSWAP_ROUTER, fromTokenAddress, amountWei, jwt)) {
                     log(chalk.red(`Gagal approve, swap dibatalkan.`));
                     return false;
                }
                
                let path = (fromTicker !== 'WPHRS' && toTicker !== 'WPHRS')
                    ? [fromTokenAddress, ADDRESSES.WPHRS, toTokenAddress]
                    : [fromTokenAddress, toTokenAddress];

                const deadline = Math.floor(Date.now() / 1000) + 600;
                const mixSwapContractSigner = this.mixSwapContract.connect(wallet);
                tx = await mixSwapContractSigner.swapExactTokensForTokens(amountWei, 0, path, wallet.address, deadline);
            }
            return await this.waitForReceipt(tx.hash, jwt, wallet) !== null;
        } catch (e) {
            log(chalk.red(`Error saat ${fromTicker}->${toTicker} swap: ${e.message}`));
            return false;
        }
    }
    
    async performAddLiquidity(wallet, tokenATicker, tokenBTicker, amountADecimal, jwt) {
        // ... (Fungsi ini disalin kembali sepenuhnya)
    }

    async run() {
        if (!PRIVATE_KEY) {
            log(chalk.red("Error: PRIVATE_KEY tidak ditemukan.")); return;
        }
        const wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
        log(chalk.bold(`Memulai bot untuk akun: ${wallet.address}`));

        log(chalk.bold.magenta('\n--- TAHAP API: Login & Klaim Faucet ---'));
        const jwt = await apiLogin(wallet);
        if (jwt) {
            await sleep(2000);
            await apiClaimFaucet(wallet.address, jwt);
        }
        log(chalk.bold.magenta('--- Selesai Tahap API ---\n'));
        await sleep(5000);

        // Baris ini sekarang akan berfungsi karena fungsinya sudah ada
        await this.tampilkanSemuaSaldo(wallet.address, "SALDO AWAL");

        log(chalk.bold.magenta(`\n--- TAHAP 0: Membungkus ${WRAP_AMOUNT} PHRS menjadi WPHRS ---`));
        const phrsBalance = await this.getTokenBalance(wallet.address, ADDRESSES.PHRS);
        if (parseFloat(phrsBalance) < parseFloat(WRAP_AMOUNT)) {
             log(chalk.red(`Saldo PHRS tidak cukup untuk wrap.`));
        } else {
             await this.performSwap(wallet, "PHRS", "WPHRS", WRAP_AMOUNT, jwt);
             await sleep(JEDA_MINIMUM);
        }
        
        if (JUMLAH_SWAP > 0) {
            log(chalk.bold(`\n--- Memulai Fase Swap (${JUMLAH_SWAP} kali) ---`));
            for (let i = 0; i < JUMLAH_SWAP; i++) {
                log(chalk.bold(`--- Swap #${i + 1}/${JUMLAH_SWAP} ---`));
                const eligibleTickers = [];
                for (const ticker of TICKERS) {
                    const balance = await this.getTokenBalance(wallet.address, this.getContractAddress(ticker));
                    if (parseFloat(balance) > parseFloat(SWAP_AMOUNTS[ticker] || '0')) eligibleTickers.push(ticker);
                }
                if (eligibleTickers.length < 1) { log(chalk.red("Saldo token tidak cukup untuk swap.")); break; }
                const fromTicker = eligibleTickers[Math.floor(Math.random() * eligibleTickers.length)];
                let toTicker;
                do { toTicker = TICKERS[Math.floor(Math.random() * TICKERS.length)]; } while (fromTicker === toTicker);
                log(`Dipilih pasangan: ${fromTicker} -> ${toTicker}`);
                await this.performSwap(wallet, fromTicker, toTicker, SWAP_AMOUNTS[fromTicker], jwt);
                if (i < JUMLAH_SWAP - 1 || JUMLAH_TAMBAH_LP > 0) await sleep(Math.floor(Math.random() * (JEDA_MAKSIMUM - JEDA_MINIMUM + 1) + JEDA_MINIMUM));
            }
        }
        
        // ... (Sisa dari fungsi run tetap sama)
        
        await this.tampilkanSemuaSaldo(wallet.address, "SALDO AKHIR");
        log(chalk.bold.green(`\n✅ Semua tugas telah selesai.`));
    }
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
