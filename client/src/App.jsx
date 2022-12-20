import React, { useEffect, useState } from 'react';
import './App.css';
import kp from './keypair.json';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Program, AnchorProvider, web3 } from '@project-serum/anchor';
import { Buffer } from 'buffer';
window.Buffer = Buffer;

// Constants
// const TEST_GIFS = [
// 	'https://media.giphy.com/media/ck69E9GRgzWOk7WmV5/giphy.gif',
// 	'https://media3.giphy.com/media/L71a8LW2UrKwPaWNYM/giphy.gif?cid=ecf05e47rr9qizx2msjucl1xyvuu47d7kf25tqt2lvo024uo&rid=giphy.gif&ct=g',
// 	'https://media4.giphy.com/media/AeFmQjHMtEySooOc8K/giphy.gif?cid=ecf05e47qdzhdma2y3ugn32lkgi972z9mpfzocjj6z1ro4ec&rid=giphy.gif&ct=g',
// 	'https://i.giphy.com/media/PAqjdPkJLDsmBRSYUp/giphy.webp',
// ];

// SystemProgram is a reference to the Solana runtime!
const { SystemProgram, Keypair } = web3;

// Create a keypair for the account that will hold the GIF data.
const arr = Object.values(kp._keypair.secretKey);
const secret = new Uint8Array(arr);
const baseAccount = web3.Keypair.fromSecretKey(secret);

// This is the address of your solana program, if you forgot, just run solana address -k target/deploy/myepicproject-keypair.json
const programID = new PublicKey('DGxn19P5Lj54Y8uctMtRTndF3o7h4iZWza5FDSrrzmVG');

// Set our network to devnet.
const network = clusterApiUrl('devnet');

// Controls how we want to acknowledge when a transaction is "done".
const opts = {
	preflightCommitment: 'processed',
};

const App = () => {
	// State
	const [walletAddress, setWalletAddress] = useState(null);
	const [inputValue, setInputValue] = useState('');
	const [gifList, setGifList] = useState([]);

	// Actions
	const checkIfWalletIsConnected = async () => {
		if (window?.solana?.isPhantom) {
			console.log('Phantom wallet found!');
			const response = await window.solana.connect({ onlyIfTrusted: true });
			console.log('Connected with Public Key:', response.publicKey.toString());

			/*
			 * Set the user's publicKey in state to be used later!
			 */
			setWalletAddress(response.publicKey.toString());
		} else {
			alert('Solana object not found! Get a Phantom Wallet 👻');
		}
	};

	const connectWallet = async () => {
		const { solana } = window;

		if (solana) {
			const response = await solana.connect();
			console.log('Connected with Public Key:', response.publicKey.toString());
			setWalletAddress(response.publicKey.toString());
		}
	};

	const sendGif = async () => {
		if (inputValue.length === 0) {
			console.log('No gif link given!');
			return;
		}
		setInputValue('');
		console.log('Gif link:', inputValue);
		try {
			const provider = getProvider();
			const program = await getProgram();

			await program.rpc.addGif(inputValue, {
				accounts: {
					baseAccount: baseAccount.publicKey,
					user: provider.wallet.publicKey,
				},
			});
			console.log('GIF successfully sent to program', inputValue);

			await getGifList();
		} catch (error) {
			console.log('Error sending GIF:', error);
		}
	};

	const getProvider = () => {
		const connection = new Connection(network, opts.preflightCommitment);
		const provider = new AnchorProvider(connection, window.solana, opts.preflightCommitment);
		return provider;
	};

	const createGifAccount = async () => {
		try {
			const provider = getProvider();
			const program = await getProgram();

			console.log('ping');
			await program.rpc.startStuffOff({
				accounts: {
					baseAccount: baseAccount.publicKey,
					user: provider.wallet.publicKey,
					systemProgram: SystemProgram.programId,
				},
				signers: [baseAccount],
			});
			console.log('Created a new BaseAccount w/ address:', baseAccount.publicKey.toString());
			await getGifList();
		} catch (error) {
			console.log('Error creating BaseAccount account:', error);
		}
	};

	const onInputChange = (event) => {
		const { value } = event.target;
		setInputValue(value);
	};

	const renderNotConnectedContainer = () => (
		<button className='cta-button connect-wallet-button' onClick={connectWallet}>
			Connect to Wallet
		</button>
	);

	const renderConnectedContainer = () => {
		// If we hit this, it means the program account hasn't been initialized.
		if (gifList === null) {
			return (
				<div className='connected-container'>
					<button className='cta-button submit-gif-button' onClick={createGifAccount}>
						Do One-Time Initialization For GIF Program Account
					</button>
				</div>
			);
		}
		// Otherwise, we're good! Account exists. User can submit GIFs.
		else {
			return (
				<div className='connected-container'>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							sendGif();
						}}
					>
						<input
							type='text'
							placeholder='Enter gif link!'
							value={inputValue}
							onChange={onInputChange}
						/>
						<button type='submit' className='cta-button submit-gif-button'>
							Submit
						</button>
					</form>
					<div className='gif-grid'>
						{/* We use index as the key instead, also, the src is now item.gifLink */}
						{gifList.map((item, index) => (
							<div className='gif-item' key={index}>
								<img src={item.gifLink} />
							</div>
						))}
					</div>
				</div>
			);
		}
	};

	// UseEffects
	useEffect(() => {
		const onLoad = async () => {
			await checkIfWalletIsConnected();
		};
		window.addEventListener('load', onLoad);
		return () => window.removeEventListener('load', onLoad);
	}, []);

	// useEffect(() => {
	// 	if (walletAddress) {
	// 		console.log('Fetching GIF list...');

	// 		// Call Solana program here.

	// 		// Set state
	// 		setGifList(TEST_GIFS);
	// 	}
	// }, [walletAddress]);

	const getProgram = async () => {
		// Get metadata about your solana program
		const idl = await Program.fetchIdl(programID, getProvider());
		// Create a program that you can call
		return new Program(idl, programID, getProvider());
	};

	const getGifList = async () => {
		try {
			const program = await getProgram();
			const account = await program.account.baseAccount.fetch(baseAccount.publicKey);

			console.log('Got the account', account);
			setGifList(account.gifList);
		} catch (error) {
			console.log('Error in getGifList: ', error);
			setGifList(null);
		}
	};

	useEffect(() => {
		if (walletAddress) {
			console.log('Fetching GIF list...');
			getGifList();
		}
	}, [walletAddress]);

	return (
		<div className='App'>
			{/* This was solely added for some styling fanciness */}
			<div className={walletAddress ? 'authed-container' : 'container'}>
				<div className='header-container'>
					<p className='header'>🏎️ Formula 1 GIF Portal</p>
					<p className='sub-text'>View your F1 GIF collection on the solana blockchain!</p>
					{/* Add the condition to show this only if we don't have a wallet address */}
					{!walletAddress && renderNotConnectedContainer()}
					{walletAddress && renderConnectedContainer()}
				</div>
			</div>
		</div>
	);
};

export default App;
