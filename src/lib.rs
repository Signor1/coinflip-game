#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

#[macro_use]
extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;

// Import Ownable contract from OpenZeppelin Stylus
use openzeppelin_stylus::access::ownable::{self, Ownable};

/// Import items from the SDK. The prelude contains common traits and macros.
use stylus_sdk::{
    alloy_primitives::{Address, U256},
    alloy_sol_types::sol,
    prelude::*,
};

// Minimal interface for the Supra VRF Router Contract
// The `generateRequest` function is used to request randomness from Supra VRF
sol_interface! {
    interface ISupraRouterContract {
        function generateRequest(string memory function_sig, uint8 rng_count, uint256 num_confirmations, address client_wallet_address) external returns(uint256);
    }
}

// Custom errors for our contract
sol! {
    // Thrown when a player's bet is less than the minimum bet
    error MinBetNotMet(uint256 min_bet, uint256 player_bet);
    // Thrown when a randomness request fails
    error RandomnessRequestFailed();
    // Thrown when a randomness fulfillment is received for a game that does not exist
    error GameNotFound();
    // Thrown when a fulfillment is received from a non-Supra router
    error OnlySupraRouter();
    // Thrown when a game is resolved twice
    error GameAlreadyResolved();
    // Thrown when a transfer fails
    error TransferFailed();
    // Thrown when the contract does not have enough balance to withdraw
    error InsufficientBalance(uint256 balance, uint256 amount);
}

// Custom events for our contract
sol! {
    // Emitted when a new game is created (new bet is placed)
    event GameCreated(uint256 indexed nonce, address indexed player, uint256 bet);
    // Emitted when a game is resolved (randomness is fulfilled and we decide win/loss)
    event GameResolved(uint256 indexed nonce, address indexed player, uint256 bet, bool won);
    // Emitted when the owner makes a withdrawal from the contract
    event Withdrawal(address indexed to, uint256 amount);
}

// Rust types for the contract errors
#[derive(SolidityError)]
pub enum Error {
    GameNotFound(GameNotFound),
    MinBetNotMet(MinBetNotMet),
    RandomnessRequestFailed(RandomnessRequestFailed),
    UnauthorizedAccount(ownable::OwnableUnauthorizedAccount),
    InvalidOwner(ownable::OwnableInvalidOwner),
    OnlySupraRouter(OnlySupraRouter),
    GameAlreadyResolved(GameAlreadyResolved),
    TransferFailed(TransferFailed),
    InsufficientBalance(InsufficientBalance),
}

// Convert OpenZeppelin Stylus errors to our custom errors
impl From<ownable::Error> for Error {
    fn from(value: ownable::Error) -> Self {
        match value {
            // If we get an UnauthorizedAccount error from the Ownable contract, map it to our UnauthorizedAccount error
            ownable::Error::UnauthorizedAccount(e) => Error::UnauthorizedAccount(e),
            // If we get an InvalidOwner error from the Ownable contract, map it to our InvalidOwner error
            ownable::Error::InvalidOwner(e) => Error::InvalidOwner(e),
        }
    }
}

sol_storage! {
    #[entrypoint]
    pub struct Coinflip {
        // Borrow the Ownable contract's storage
        #[borrow]
        Ownable ownable;

        // Address of the subscription manager on Supra
        // i.e. the address which is funding the randomness requests
        address subscription_manager;

        // Address of the Supra router contract where we request randomness
        address supra_router;

        // Minimum bet amount per game
        uint256 min_bet;

        // Mapping of game nonces to game data
        // Each game is uniquely identified by its nonce
        mapping(uint256 => Game) games;
    }

    // Struct to store game data
    pub struct Game {
        uint256 bet;
        address player;
        uint256 randomness;
        bool resolved;
        bool won;
    }
}

// Private functions on our contract
impl Coinflip {
    // Internal helper function to request randomness from Supra VRF
    fn request_randomness(&mut self) -> Result<U256, Error> {
        let subscription_manager = self.subscription_manager.get();
        let router = ISupraRouterContract::from(self.supra_router.get());
        let request_result = router.generate_request(
            &mut *self,
            String::from("fulfillRandomness(uint256,uint256[])"),
            1,
            U256::from(1),
            subscription_manager,
        );

        match request_result {
            Ok(nonce) => Ok(nonce),
            Err(_) => Err(Error::RandomnessRequestFailed(RandomnessRequestFailed {})),
        }
    }
}

// Public functions on our contract
#[public]
#[inherit(Ownable)]
impl Coinflip {
    // Constructor for the contract, called when the contract is deployed
    #[constructor]
    pub fn constructor(
        &mut self,
        subscription_manager: Address,
        supra_router: Address,
        min_bet: U256,
    ) -> Result<(), Error> {
        let initial_owner = self.vm().tx_origin();

        self.subscription_manager.set(subscription_manager);
        self.supra_router.set(supra_router);
        self.min_bet.set(min_bet);

        Ok(self.ownable.constructor(initial_owner)?)
    }

    // Place a bet and start a new game
    #[payable]
    pub fn new_game(&mut self) -> Result<(), Error> {
        let bet = self.vm().msg_value();
        let player = self.vm().msg_value();

        // Check if the bet is greater than the minimum bet
        if bet < self.min_bet.get(){
            return Err(Error::MinBetNotMet(MinBetNotMet {
                        min_bet: self.min_bet.get(),
                        player_bet: bet,
                    }));
        }

        // Request randomness from Supra VRF, and generate a new game nonce
        let nonce = self.request_randomness()?;

        // Set the game data
            let mut game_setter = self.games.setter(nonce);
            game_setter.bet.set(bet);
            game_setter.player.set(player);
            game_setter.resolved.set(false);
            game_setter.won.set(false);
            game_setter.randomness.set(U256::ZERO);

            // Log the game creation event
            log(self.vm(), GameCreated { nonce, player, bet });

            Ok(())
    }

    // Callback function from Supra VRF, called when the randomness is fulfilled
    // This is not meant to be called by users
    pub fn fulfill_randomness(&mut self, nonce: U256, rng_list: Vec<U256>) -> Result<(), Error> {
        let sender = self.vm().msg_sender();

            // If the caller is not the Supra router, return an error
            if sender != self.supra_router.get() {
                return Err(Error::OnlySupraRouter(OnlySupraRouter {}));
            }
    }

    // Withdraw funds from the contract
    pub fn withdraw(&mut self, amount: U256) -> Result<(), Error> {
        todo!()
    }

    // Generic receive() function to allow the contract to receive ETH
    // without having to explicitly call a function
    // We will use this to initially fund the contract with some ETH so we have money
    // to pay users if the first person to play wins
    #[receive]
    #[payable]
    pub fn receive(&mut self) -> Result<(), Vec<u8>> {
        Ok(())
    }
}
