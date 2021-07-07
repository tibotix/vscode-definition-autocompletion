# C/C++ Definition Autocompletion

**Autocomplete function definitions from already declared function signatures.**

<br>

## Features
-----------

To trigger the autocompletion, type a `.` on a new blank line in your `.c/.cpp` file.

<br>

- ### **Support for member class functions:**
![Member function completion demo](images/member_function_completion_demo.gif)

<br>


- ### **As well as for normal functions:**
![Function completion demo](images/function_completion_demo.gif)

<br>

- ### **Support for template functions:**
![Template completion demo](images/template_completion_demo.gif)

<br>

- ### **Detecting in header defined functions and don't suggesting them:**
![Inline demo](images/inline_demo.gif)

<br>

- ### **Supporting nested member class functions:**
![Nested member function completion demo](images/nested_member_function_completion_demo.gif)

<br>

- ### **Special autocompletion handling for constructors:**
![Constructor demo](images/constructor_demo.gif)

<br>


- ### **Only function declarations with no function definition are suggested.**


<br>

## Requirements
---------------

- C/C++ Extension

<br>

## Extension Settings
---------------------

This extension contributes the following settings:

* `definition-autocompletion.trigger_character`: The character that triggers the completion suggestion on a new blank line.
* `definition-autocompletion.update_index_on_save`: Wether to update the symbol index table on save.
* `definition-autocompletion.update_index_on_change`: Wether to update the symbol index table when changing the active text editor

<br>

## Known Issues
---------------

- When trigger the suggestion on a file not parsed yet, the function definition right after the triggerCharacter is not parsed correctly.
- nested return Types are not extended by the outer layer Type

<br>

## Future Plans
---------------

- fix issues

<br>

## Release Notes
----------------

### 1.1.1

- supporting constructors member initialization list

### 1.1.0

 - supporting templates
 - supporting inline functions
 - supporting nested class members

### 1.0.0

 - Initial release

