// index.js (VERSI FINAL YANG SUDAH DIPERIKSA ULANG)
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

// ===================================================================================
// UTILITIES
// ===================================================================================

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

// ===================================================================================
// BLOCKCHAIN INTERACTIONS
// ===================================================================================

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
    const allowance = await tokenContract.allowance(wallet.address, spenderAddress);
    if (allowance < amount) {
        log(`Membutuhkan approval untuk token ${tokenAddress} ke spender ${spenderAddress}...`);
        const tx = await tokenContract.approve(spenderAddress, MaxUint256);
        log(`Approval transaction dikirim: ${chalk.yellow(tx.hash)}`);
        await tx.wait();
        log(chalk.green('Approval berhasil!'));
        await sleep(5000);
    } else {
        log(chalk.gray(`Approval sudah cukup untuk token ${tokenAddress}.`));
    }
}

// ===================================================================================
// CORE FUNCTIONS
// ===================================================================================

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

async function performWithdraw(amount) {
    const wphrsContract = new ethers.Contract(config.WPHRS_CONTRACT_ADDRESS, config.ERC20_ABI, wallet);
    const amountInWei = ethers.parseEther(amount.toString());
    log(`Melakukan withdraw ${amount} WPHRS menjadi PHRS...`);
    const { balance } = await getBalance(config.WPHRS_CONTRACT_ADDRESS);
    if (balance < amountInWei) {
        log(chalk.red(`Saldo WPHRS tidak cukup. Saldo: ${ethers.formatEther(balance)}`));
        return;
    }
    try {
        const tx = await wphrsContract.withdraw(amountInWei);
        log(`Withdraw transaction dikirim: ${chalk.yellow(tx.hash)}`);
        const receipt = await tx.wait();
        log(chalk.green(`Withdraw berhasil! Block: ${receipt.blockNumber}`));
    } catch (error) {
        log(chalk.red(`Withdraw gagal: ${error.message}`));
    }
}

async function performSwap(fromToken, toToken, amount) {
    log(chalk.yellow(`Mempersiapkan swap ${amount} ${fromToken.name} ke ${toToken.name} via Router Kustom...`));
    const router = new ethers.Contract(config.POOL_ROUTER_ADDRESS, config.UNISWAP_V2_ABI, wallet);
    const { balance, decimals } = await getBalance(fromToken.address);
    const amountIn = ethers.parseUnits(amount.toString(), decimals);

    if (balance < amountIn) {
        log(chalk.red(`Saldo ${fromToken.name} tidak cukup. Saldo: ${ethers.formatUnits(balance, decimals)}`));
        return;
    }
    try {
        await approveToken(fromToken.address, config.POOL_ROUTER_ADDRESS, amountIn);
        const path = [fromToken.address, toToken.address];
        const deadline = Math.floor(Date.now() / 1000) + 600;

        const amountsOut = await router.getAmountsOut(amountIn, path, [30]);
        const amountOutMin = amountsOut[1] - (amountsOut[1] * BigInt(Math.floor(settings.slippage_percent * 100))) / BigInt(10000);
        
        const tx = await router.swapExactTokensForTokens(amountIn, amountOutMin, path, wallet.address, deadline);
        log(`Swap transaction dikirim: ${chalk.yellow(tx.hash)}`);
        const receipt = await tx.wait();
        log(chalk.green(`Swap dari ${fromToken.name} ke ${toToken.name} berhasil! Block: ${receipt.blockNumber}`));
    } catch (error) {
        log(chalk.red(`Swap gagal: ${error.message}`));
    }
}

async function performAddLiquidity(tokenA, tokenB, amountA) {
    log(`Mempersiapkan penambahan likuiditas untuk ${amountA} ${tokenA.name} dan ${tokenB.name}...`);
    const router = new ethers.Contract(config.POOL_ROUTER_ADDRESS, config.UNISWAP_V2_ABI, wallet);
    const { balance: balanceA, decimals: decimalsA } = await getBalance(tokenA.address);
    const amountADesired = ethers.parseUnits(amountA.toString(), decimalsA);

    if (balanceA < amountADesired) {
        log(chalk.red(`Saldo ${tokenA.name} tidak cukup. Saldo: ${ethers.formatUnits(balanceA, decimalsA)}`));
        return;
    }
    try {
        const amountsOut = await router.getAmountsOut(amountADesired, [tokenA.address, tokenB.address], [30]);
        const amountBDesired = amountsOut[1];

        const { balance: balanceB, decimals: decimalsB } = await getBalance(tokenB.address);
        if (balanceB < amountBDesired) {
            log(chalk.red(`Saldo ${tokenB.name} tidak cukup. Saldo: ${ethers.formatUnits(balanceB, decimalsB)}, Dibutuhkan: ${ethers.formatUnits(amountBDesired, decimalsB)}`));
            return;
        }
        log(`Dibutuhkan ${ethers.formatUnits(amountBDesired, decimalsB)} ${tokenB.name} untuk likuiditas.`);

        await approveToken(tokenA.address, config.POOL_ROUTER_ADDRESS, amountADesired);
        await approveToken(tokenB.address, config.POOL_ROUTER_ADDRESS, amountBDesired);

        const deadline = Math.floor(Date.now() / 1000) + 600;
        const amountAMin = amountADesired - (amountADesired * BigInt(Math.floor(settings.slippage_percent * 100))) / BigInt(10000);
        const amountBMin = amountBDesired - (amountBDesired * BigInt(Math.floor(settings.slippage_percent * 100))) / BigInt(10000);
        
        const tx = await router.addLiquidity(
            tokenA.address, tokenB.address, 30,
            amountADesired, amountBDesired,
            amountAMin, amountBMin,
            wallet.address, deadline
        );
        log(`Add Liquidity transaction dikirim: ${chalk.yellow(tx.hash)}`);
        const receipt = await tx.wait();
        log(chalk.green(`Add Liquidity berhasil! Block: ${receipt.blockNumber}`));
    } catch (error) {
        log(chalk.red(`Add Liquidity gagal: ${error.message}`));
    }
}

// ===================================================================================
// MAIN EXECUTION LOGIC
// ===================================================================================
async function runBot() {
    log(chalk.bold.green('Memulai eksekusi bot otomatis...'));
    log(`Menggunakan alamat: ${chalk.green(wallet.address)}`);
    for (const task of settings.execution_order) {
        log(chalk.bold.magenta(`\n--- Menjalankan Tugas: ${task.toUpperCase()} ---`));
        switch (task) {
            case 'deposit':
                if (settings.deposit.enabled) await performDeposit(settings.deposit.amount);
                else log(chalk.yellow('Deposit dinonaktifkan, dilewati.'));
                break;
            case 'withdraw':
                if (settings.withdraw.enabled) await performWithdraw(settings.withdraw.amount);
                else log(chalk.yellow('Withdraw dinonaktifkan, dilewati.'));
                break;
            case 'swap':
                if (settings.swap.enabled) {
                    const totalSwaps = Math.min(settings.swap.tx_count, settings.swap.pairs_and_amounts.length);
                    for (let i = 0; i < totalSwaps; i++) {
                        log(chalk.blue(`Melakukan swap ke-${i + 1} dari ${totalSwaps}...`));
                        const pair = settings.swap.pairs_and_amounts[i];
                        const fromToken = { name: pair.from, address: config.tickers[pair.from] };
                        const toToken = { name: pair.to, address: config.tickers[pair.to] };
                        await performSwap(fromToken, toToken, pair.amount);
                        if (i < totalSwaps - 1) await randomDelay();
                    }
                } else log(chalk.yellow('Swap dinonaktifkan, dilewati.'));
                break;
            case 'addLP':
                if (settings.addLP.enabled) {
                    const totalLPs = Math.min(settings.addLP.tx_count, settings.addLP.pairs_and_amounts.length);
                    for (let i = 0; i < totalLPs; i++) {
                        log(chalk.blue(`Melakukan Add LP ke-${i + 1} dari ${totalLPs}...`));
                        const pair = settings.addLP.pairs_and_amounts[i];
                        const tokenA = { name: pair.tokenA, address: config.tickers[pair.tokenA] };
                        const tokenB = { name: pair.tokenB, address: config.tickers[pair.tokenB] };
                        await performAddLiquidity(tokenA, tokenB, pair.amountA);
                        if (i < totalLPs - 1) await randomDelay();
                    }
                } else log(chalk.yellow('Add LP dinonaktifkan, dilewati.'));
                break;
            default:
                log(chalk.red(`Tugas tidak dikenal: ${task}`));
        }
    }
}

async function start() {
    while (true) {
        await runBot().catch(err => console.error(chalk.red.bold('Terjadi error fatal pada eksekusi bot:'), err));
        if (settings.run_in_loop.enabled) {
            const delayMinutes = settings.run_in_loop.loop_delay_minutes;
            log(chalk.bold.green(`\n=== Siklus selesai. Bot akan berjalan lagi dalam ${delayMinutes} menit. ===`));
            await sleep(delayMinutes * 60 * 1000);
        } else {
            log(chalk.bold.green('\n=== Semua tugas selesai. Bot berhenti. ==='));
            break;
        }
    }
}

start();
