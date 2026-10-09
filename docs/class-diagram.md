# One Wallet: Class Diagram

Design blueprint for the Blazor version of One Wallet. It mirrors the logic already working in the HTML prototype (`index.html`). GitHub renders the diagrams below automatically.

## 1. Domain models and services

```mermaid
classDiagram
    direction TB

    class Wallet {
        +int Id
        +string Name
        +string Provider
        +decimal Balance
    }
    class Transaction {
        +int Id
        +DateOnly Date
        +string Merchant
        +Category Category
        +decimal Amount
        +int WalletId
        +TransactionSource Source
        +IsExpense() bool
    }
    class Bill {
        +int Id
        +string Name
        +decimal Amount
        +DateOnly DueDate
        +BillFrequency Frequency
    }
    class BudgetSettings {
        +DateOnly PayDay
        +BudgetPeriod Period
        +decimal IncomePerPeriod
    }
    class ParsedAlert {
        +decimal Amount
        +bool IsIncome
        +string Merchant
        +Category Category
        +string WalletName
        +bool IsValid
        +string Error
    }
    class RunwaySummary {
        +decimal TotalBalance
        +decimal BillsReserved
        +int DaysLeft
        +decimal DailyAmount
    }
    class CategoryTotal {
        +Category Category
        +decimal Total
    }

    class Category {
        <<enumeration>>
        Food
        Transport
        Load
        Bills
        Income
        Others
    }
    class TransactionSource {
        <<enumeration>>
        Manual
        Imported
        Adjustment
    }
    class BudgetPeriod {
        <<enumeration>>
        Weekly
        SemiMonthly
        Monthly
        Custom
    }
    class BillFrequency {
        <<enumeration>>
        Weekly
        Monthly
        Yearly
    }

    class AppState {
        +List~Wallet~ Wallets
        +List~Transaction~ Transactions
        +List~Bill~ Bills
        +BudgetSettings Settings
        +Load()
        +Save()
        +Reset()
        +OnChange event
    }
    class IStorageService {
        <<interface>>
        +Save(key, json)
        +Load(key) string
    }
    class LocalStorageService {
        +Save(key, json)
        +Load(key) string
    }

    class WalletService {
        +Add(name, provider, balance) Wallet
        +GetTotalBalance() decimal
        +Reconcile(walletId, realBalance)
    }
    class TransactionService {
        +Add(walletId, amount, merchant, category, source) Transaction
        +Delete(id)
        +GetByWallet(walletId) List~Transaction~
        +GetRecent(count) List~Transaction~
    }
    class BillService {
        +Add(name, amount, dueDate, frequency) Bill
        +Remove(id)
        +GetTotalReserved() decimal
    }
    class RunwayCalculator {
        +Calculate(balance, billsReserved, payDay, today) RunwaySummary
    }
    class InsightsService {
        +GetCategoryTotals() List~CategoryTotal~
        +GetTotalIncome() decimal
        +GetTotalExpenses() decimal
    }
    class IAlertParser {
        <<interface>>
        +CanParse(text) bool
        +Parse(text) ParsedAlert
    }
    class GCashParser
    class MayaParser
    class GoTymeParser
    class AlertImportService {
        +Read(text) ParsedAlert
        +Confirm(alert, walletId) Transaction
    }

    Wallet "1" --> "*" Transaction : has
    Transaction ..> Category
    Transaction ..> TransactionSource
    Bill ..> BillFrequency
    BudgetSettings ..> BudgetPeriod
    ParsedAlert ..> Category

    AppState "1" o-- "*" Wallet
    AppState "1" o-- "*" Transaction
    AppState "1" o-- "*" Bill
    AppState "1" o-- "1" BudgetSettings
    AppState ..> IStorageService : saves via
    IStorageService <|.. LocalStorageService

    WalletService ..> AppState
    TransactionService ..> AppState
    BillService ..> AppState
    InsightsService ..> AppState
    WalletService ..> TransactionService : adds adjustment entry
    RunwayCalculator ..> RunwaySummary : returns
    InsightsService ..> CategoryTotal : returns

    IAlertParser <|.. GCashParser
    IAlertParser <|.. MayaParser
    IAlertParser <|.. GoTymeParser
    IAlertParser ..> ParsedAlert : returns
    AlertImportService "1" --> "*" IAlertParser : tries each
    AlertImportService ..> TransactionService : adds confirmed alert
```

## 2. Blazor pages and the services they use

```mermaid
classDiagram
    direction LR

    class ComponentBase {
        <<abstract>>
    }
    class Login
    class Dashboard
    class WalletsPage
    class WalletDetail
    class TransactionsPage
    class ImportPage
    class BillsPage
    class InsightsPage
    class SettingsPage
    class HelpPage

    ComponentBase <|-- Login
    ComponentBase <|-- Dashboard
    ComponentBase <|-- WalletsPage
    ComponentBase <|-- WalletDetail
    ComponentBase <|-- TransactionsPage
    ComponentBase <|-- ImportPage
    ComponentBase <|-- BillsPage
    ComponentBase <|-- InsightsPage
    ComponentBase <|-- SettingsPage
    ComponentBase <|-- HelpPage

    Dashboard ..> RunwayCalculator
    Dashboard ..> WalletService
    Dashboard ..> TransactionService
    Dashboard ..> BillService
    WalletsPage ..> WalletService
    WalletDetail ..> WalletService
    WalletDetail ..> TransactionService
    TransactionsPage ..> TransactionService
    ImportPage ..> AlertImportService
    BillsPage ..> BillService
    InsightsPage ..> InsightsService
    SettingsPage ..> AppState
```

## 3. Suggested project structure

```
OneWallet/
├── Models/        Wallet, Transaction, Bill, BudgetSettings, ParsedAlert, RunwaySummary, CategoryTotal, enums
├── Services/      AppState, WalletService, TransactionService, BillService,
│                  RunwayCalculator, InsightsService, AlertImportService, LocalStorageService
├── Parsers/       IAlertParser, GCashParser, MayaParser, GoTymeParser
├── Pages/         Login, Dashboard, WalletsPage, WalletDetail, TransactionsPage,
│                  ImportPage, BillsPage, InsightsPage, SettingsPage, HelpPage
└── Program.cs     registers every service for dependency injection
```

## 4. Where each class comes from in the prototype

| Class | Prototype code it replaces |
|---|---|
| `RunwayCalculator` | `per()`, `days()`, `res()`: (balance minus bills) divided by days until payday |
| `AlertImportService` + parsers | `rd()` and `okp()` |
| `WalletService.Reconcile` | `doRec()`: adds an Adjustment transaction for the difference |
| `TransactionService` | `add()` and `del()`: each one updates the wallet balance |
| `InsightsService` | the `ins` view: sums expenses by category |
| `AppState` + `LocalStorageService` | the `S` object and the localStorage save and load |

## 5. Build order
1. Models and enums
2. `AppState` and the services (no UI yet)
3. `RunwayCalculator` and the parsers, with unit tests
4. Pages, one at a time, starting with Dashboard
5. Register everything in `Program.cs`
