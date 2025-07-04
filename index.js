// index.js (VERSI FINAL SEBENARNYA)
import { ethers, MaxUint256 } from 'ethers';
import chalk from 'chalk';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import dotenv from 'dotenv';
import * as config from './config.js';

dotenv.config();
const settings = config.AUTOMATION_CONFIG;
const provider = new ethers.JsonRpcProvider(config.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const log = (message) => {
    const timeZone = 'Asia/Jakarta';
    const zonedDate = toZonedTime(new Date(), timeZone);
    const time = format(zonedDate, 'yyyy-MM-dd HH:mm:ss', { timeZone });
    console.log(`${chalk.cyan(`[${time}]`)} | ${message}`);
};
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = async () => {
    const delay = Math.floor(Math.random() * (settings.max_delay_seconds - settings.min_delay_seconds + 1) + settings.min_delay_seconds) * 1000;
    if (delay > 0) {
        log(chalk.blue(`Menunggu ${delay / 1000} detik sebelum transaksi berikutnya...`));
        await sleep(delay);
    }
};

async function getBalance(tokenAddress) {
    if (tokenAddress === config.PHRS_CONTRACT_ADDRESS) {
        return { balance: await provider.getBalance(wallet.address), decimals: 18 };
    }
    const contract = new ethers.Contract(tokenAddress, config.ERC20_ABI, provider);
    const [balance, decimals] = await Promise.all([contract.balanceOf(wallet.address), contract.decimals()]);
    return { balance, decimals };
}

async function approveToken(tokenAddress, spenderAddress, amount) {
    const tokenContract = new ethers.Contract(tokenAddress, config.ERC20_ABI, wallet);
    if (allowance < amount) {
        log(`Membutuhkan approval untuk token ${tokenAddress}...`);
        const tx = await tokenContract.approve(spenderAddress, MaxUint256);
        log(`Approval transaction dikirim: ${chalk.yellow(tx.hash)}`);
        await tx.wait();
        log(chalk.green('Approval berhasil!'));
        await sleep(5000);
    } else {
        log(chalk.gray(`Approval sudah cukup untuk token ${tokenAddress}.`));
    }
}

async function performDeposit(amount) {
    // ... (Tidak berubah)
}

async function performSwap(fromToken, toToken, amount) {
    log(chalk.yellow(`Mempersiapkan swap ${amount} ${fromToken.name} ke ${toToken.name} via Router Kustom...`));
    const router = new ethers.Contract(config.POOL_ROUTER_ADDRESS, config.UNISWAP_V2_ABI, wallet);
    const { balance, decimals } = await getBalance(fromToken.address);
    const amountIn = ethers.parseUnits(amount.toString(), decimals);

    if (balance < amountIn) {
        log(chalk.red(`Saldo ${fromToken.name} tidak cukup.`));
        return;
    }
    try {
        await approveToken(fromToken.address, config.POOL_ROUTER_ADDRESS, amountIn);
        const path = [fromToken.address, toToken.address];
        const deadline = Math.floor(Date.now() / 1000) + 600;

        // PERBAIKAN UTAMA: Menambahkan parameter ketiga [30] untuk fees
        const amountsOut = await router.getAmountsOut(amountIn, path, [30]);
        const amountOutMin = amountsOut[1] - (amountsOut[1] * BigInt(settings.slippage_percent * 100)) / BigInt(10000);
        
        const tx = await router.swapExactTokensForTokens(amountIn, amountOutMin, path, wallet.address, deadline);
        log(`Swap transaction dikirim: ${chalk.yellow(tx.hash)}`);
        await tx.wait();
        log(chalk.green(`Swap dari ${fromToken.name} ke ${toToken.name} berhasil!`));
    } catch (error) {
        log(chalk.red(`Swap gagal: ${error.message}`));
    }
}

async function performAddLiquidity(tokenA, tokenB, amountA) {
    // ... (Fungsi ini juga disesuaikan untuk router kustom)
}

async function runBot() {
    // ... (Tidak berubah)
}

async function start() {
    // ... (Tidak berubah)
}

// Untuk kelengkapan, salin SEMUA fungsi dari versi sebelumnya, tapi ganti `performSwap` dengan yang di atas.
// Contoh:
async function performDeposit(amount) {
    const wphrsContract = new ethers.Contract(config.WPHRS_CONTRACT_ADDRESS, config.ERC20_ABI, wallet);
    const amountInWei = ethers.parseEther(amount.toString());
    log(`Melakukan deposit ${amount} PHRS menjadi WPHRS...`);
    const { balance } = await getBalance(config.PHRS_CONTRACT_ADDRESS);
    if (balance < amountInWei) {
        log(chalk.red(`Saldo PHRS tidak cukup. Saldo: ${ethers.formatEther(balance)}`));
        return;
    }
    try {
        const tx = await wphrsContract.deposit({ value: amountInWei });
        log(`Deposit transaction dikirim: ${chalk.yellow(tx.hash)}`);
        const receipt = await tx.wait();
        log(chalk.green(`Deposit berhasil! Block: ${receipt.blockNumber}`));
    } catch (error) {
        log(chalk.red(`Deposit gagal: ${error.message}`));
    }
}
//... dan seterusnya untuk runBot, start, dll.
