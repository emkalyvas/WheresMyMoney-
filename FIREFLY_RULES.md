# WheresMyMoney! - Firefly III Rules & Conventions

This document outlines all the specific rules, tagging conventions, and account structures required in your Firefly III instance for **WheresMyMoney!** to accurately calculate your company's statistics, taxes, and VAT.

---

## 1. Company Transactions (Income & Expenses)
By default, the application separates personal finances from your business. 
* **Rule**: For a transaction to be considered part of the company's revenue or expenses (and thus used for tax calculations), it **must** include the tag defined in the `COMPANY_TAG` environment variable (default: `MnApps`).
* **Transfers**: Transfer transactions between your own asset accounts are ignored and do not count towards income or expenses.

---

## 2. VAT Calculation & Extraction
All transaction amounts stored in Firefly III are assumed to be **Gross** (including VAT). The application automatically extracts the VAT to calculate your Net Revenue, Net Expenses, and Corporate Income Tax.

The VAT percentage applied to each transaction is determined in the following order:
1. **No VAT Tag**: If the transaction contains the tag defined in `NO_VAT_TAG` (default: `No VAT`), the VAT applied is **0%**.
2. **Custom VAT Tag**: If the transaction contains a tag starting with the prefix defined in `VAT_TAG` (default: `ΦΠΑ`), the application extracts the last two characters as the VAT percentage.
   * *Example*: If the tag is `ΦΠΑ 13` or `ΦΠΑ13`, the VAT applied is **13%**.
3. **Default VAT**: If neither of the above tags is present, the transaction falls back to the percentage defined in `DEFAULT_VAT` (default: **24%**).

---

## 3. VAT Paid to the Government
To track how much VAT you have already paid to the tax authority within the current year and calculate your remaining **VAT Liability**:

* **Rule**: You must create a withdrawal (expense) transaction and tag it with **all** the tags defined in the `VAT_EXPENSE_TAG` environment variable (default: `Εφορια,ΦΠΑ`).
* **Matching**: The application uses case-insensitive and accent-insensitive matching (e.g., `Εφορια` matches `Εφορία` and `εφορία`). If a transaction contains all required tags, its entire amount is considered as VAT Paid to the government.

---

## 4. Advance Tax (Προκαταβολή)
To accurately calculate your expected Corporate Income Tax for the current year, the application deducts the advance tax you prepaid the previous year. 

* **Rule 1 (Account Name)**: You must have a **Liability Account** named exactly `Φόρος Εισοδήματος YYYY` (where YYYY is the previous year). 
   * *Example*: If the current year is 2026, the account name must be `Φόρος Εισοδήματος 2025`.
* **Rule 2 (Notes Field)**: In the **Notes** section of that specific liability account, you must declare the amount using the following format:
   * `Προκαταβολή: [amount]` (e.g., `Προκαταβολή: 1500.50`)
* **Matching**: This is case-insensitive and accepts both `Προκαταβολή` and `Προκαταβολη`.

---

## 5. Ignored Accounts
Sometimes you have accounts in Firefly III that you don't want to skew your WheresMyMoney! statistics (e.g., an investment account tracked via Trading212 instead).

* **Rule 1 (Firefly Settings)**: If you uncheck the **"Include in net worth"** setting for an account inside Firefly III, WheresMyMoney! will completely ignore it and all transactions associated with it.
* **Rule 2 (Environment Variable)**: You can forcefully ignore accounts by adding their exact names to the `IGNORE_FIREFLY_ACCOUNTS` environment variable (comma-separated, e.g., `Trading212`).

---

## Environment Variables Quick Reference
Here are the relevant `.env` variables that power these rules:

```env
COMPANY_TAG=MnApps
VAT_TAG=ΦΠΑ
NO_VAT_TAG=No VAT
DEFAULT_VAT=24
VAT_EXPENSE_TAG=Εφορια,ΦΠΑ
IGNORE_FIREFLY_ACCOUNTS=Trading212
```
